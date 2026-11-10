import * as path from 'path';
import * as vscode from 'vscode';
import { CompilerService } from '../services/compiler-service';

export class PreviewManager implements vscode.Disposable {
    private readonly panels = new Map<string, SlidePreview>();

    public open(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'slidedeckml') {
            void vscode.window.showErrorMessage('Open a SlideDeckML file before starting the preview.');
            return;
        }
        if (!vscode.workspace.isTrusted) {
            void vscode.window.showErrorMessage('Trust this workspace before opening a SlideDeckML preview.');
            return;
        }
        const key = editor.document.uri.toString();
        const existing = this.panels.get(key);
        if (existing) {
            existing.reveal();
            return;
        }
        const preview = new SlidePreview(editor.document, editor.viewColumn, () => this.panels.delete(key));
        this.panels.set(key, preview);
    }

    public dispose(): void {
        for (const panel of this.panels.values()) panel.dispose();
        this.panels.clear();
    }
}

class SlidePreview implements vscode.Disposable {
    private readonly panel: vscode.WebviewPanel;
    private readonly subscriptions: vscode.Disposable[] = [];
    private timer: ReturnType<typeof setTimeout> | undefined;
    private revision = 0;
    private startLines: number[] = [];
    private disposed = false;
    private ready = false;
    private pendingError: string | undefined;
    private compiledVersion: number | undefined;
    private displayedRevision: number | undefined;

    constructor(private readonly document: vscode.TextDocument, private readonly editorColumn: vscode.ViewColumn | undefined, onDispose: () => void) {
        const roots = (vscode.workspace.workspaceFolders || []).map(folder => folder.uri);
        if (document.uri.scheme === 'file') {
            roots.push(vscode.Uri.file(path.dirname(document.uri.fsPath)));
        }
        this.panel = vscode.window.createWebviewPanel(
            'slidedeckml.preview',
            `Preview: ${path.basename(document.fileName)}`,
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: roots }
        );
        this.panel.webview.html = this.placeholder();
        this.subscriptions.push(
            this.panel.onDidDispose(() => {
                this.dispose();
                onDispose();
            }),
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.uri.toString() === this.document.uri.toString()) this.schedule();
            }),
            vscode.window.onDidChangeTextEditorSelection(event => {
                if (event.textEditor.document.uri.toString() === this.document.uri.toString()) {
                    this.updateSlide(event.selections[0]?.active.line);
                }
            }),
            this.panel.webview.onDidReceiveMessage(message => {
                if (message && message.type === 'ready') {
                    this.ready = true;
                    this.updateSlide();
                    if (this.pendingError) this.showError(this.pendingError);
                } else if (message && message.type === 'revealSource') {
                    void this.revealSource(message.index, message.revision);
                }
            })
        );
        this.schedule();
    }

    public reveal(): void {
        this.panel.reveal(vscode.ViewColumn.Beside, true);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.revision++;
        if (this.timer) clearTimeout(this.timer);
        for (const subscription of this.subscriptions) subscription.dispose();
        this.panel.dispose();
    }

    private schedule(): void {
        const revision = ++this.revision;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            void this.compile(revision);
        }, 350);
    }

    private async compile(revision: number): Promise<void> {
        try {
            const source = this.document.getText();
            const version = this.document.version;
            const sourcePath = this.document.uri.scheme === 'file' ? this.document.uri.fsPath : undefined;
            const result = await new CompilerService().compile(source, undefined, sourcePath, { useUrlHash: false });
            if (this.disposed || revision !== this.revision) return;
            if (result.error) {
                this.showError(result.error);
                return;
            }
            this.startLines = result.slideStartLines || [];
            const html = this.previewHtml(result.html, revision);
            this.compiledVersion = version;
            this.displayedRevision = revision;
            this.pendingError = undefined;
            this.ready = false;
            this.panel.webview.html = html;
        } catch (error) {
            if (!this.disposed && revision === this.revision) {
                this.showError(error instanceof Error ? error.message : String(error));
            }
        }
    }

    private showError(text: string): void {
        this.pendingError = text;
        if (this.ready) void this.panel.webview.postMessage({ type: 'error', text });
    }

    private async revealSource(index: unknown, revision: unknown): Promise<void> {
        if (revision !== this.displayedRevision || !Number.isInteger(index) ||
            typeof index !== 'number' || index < 0 || index >= this.startLines.length) return;
        if (this.document.version !== this.compiledVersion) {
            void vscode.window.showWarningMessage('The preview is out of date. Fix any errors and wait for it to update before navigating to the source.');
            return;
        }
        try {
            const visible = vscode.window.visibleTextEditors.find(
                item => item.document.uri.toString() === this.document.uri.toString()
            );
            const editor = await vscode.window.showTextDocument(this.document, {
                viewColumn: visible?.viewColumn ?? this.editorColumn,
                preserveFocus: false
            });
            if (this.disposed || revision !== this.displayedRevision || this.document.version !== this.compiledVersion) return;
            const position = new vscode.Position(this.startLines[index], 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        } catch (error) {
            void vscode.window.showErrorMessage(`Could not open slide source: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private updateSlide(line?: number): void {
        const editor = vscode.window.visibleTextEditors.find(
            item => item.document.uri.toString() === this.document.uri.toString()
        );
        const currentLine = line ?? editor?.selection.active.line ?? 0;
        let slide = 0;
        for (let i = 0; i < this.startLines.length; i++) {
            if (this.startLines[i] > currentLine) break;
            slide = i;
        }
        void this.panel.webview.postMessage({ type: 'slide', index: slide });
    }

    private placeholder(): string {
        return `<!DOCTYPE html><html><body><p>Compiling presentation...</p>${this.bridge(false, 0)}</body></html>`;
    }

    private previewHtml(html: string, revision: number): string {
        let base = '';
        if (this.document.uri.scheme === 'file') {
            const directory = vscode.Uri.file(path.dirname(this.document.uri.fsPath));
            const uri = this.panel.webview.asWebviewUri(directory).toString().replace(/\/?$/, '/');
            base = `<base href="${uri.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`;
        }
        const source = this.panel.webview.cspSource;
        const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https: http:; style-src 'unsafe-inline' https: http:; img-src ${source} data: https: http:; media-src ${source} data: blob: https: http:; font-src ${source} data: https: http:; connect-src ${source} https: http: ws: wss:; frame-src https: http: blob:;">`;
        const head = html.replace('<head>', `<head>${csp}${base}`);
        const end = head.lastIndexOf('</body>');
        if (end < 0) throw new Error('Generated presentation has no closing body tag.');
        return head.slice(0, end) + this.bridge(true, revision) + head.slice(end);
    }

    private bridge(presentation: boolean, revision: number): string {
        return `<div id="sdml-preview-error" role="alert" style="display:none;position:fixed;top:0;left:0;right:0;z-index:99999;background:#822;color:white;padding:12px;white-space:pre-wrap"></div>
<script>
(() => {
    const vscode = acquireVsCodeApi();
    let slide = 0;
    function navigate() {
        if (window.Reveal && Reveal.isReady()) Reveal.slide(slide, 0);
    }
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'slide') {
            slide = message.index;
            navigate();
        } else if (message.type === 'error') {
            const banner = document.getElementById('sdml-preview-error');
            banner.textContent = message.text;
            banner.style.display = 'block';
        }
    });
    document.addEventListener('dblclick', event => {
        if (!window.Reveal || !Reveal.isReady() || !(event.target instanceof Element)) return;
        const current = Reveal.getCurrentSlide();
        if (!current || !current.contains(event.target) ||
            event.target.closest('a, button, input, textarea, select, video, audio, canvas, [contenteditable], [role="button"], .monaco-editor')) return;
        const attribute = current.getAttribute('data-slide-index');
        if (attribute === null || !/^\\d+$/.test(attribute)) return;
        const index = Number(attribute);
        if (Number.isInteger(index) && index >= 0) vscode.postMessage({ type: 'revealSource', index, revision: ${revision} });
    });
    if (window.Reveal) {
        if (Reveal.isReady()) navigate();
        else Reveal.on('ready', navigate);
    } else if (${presentation}) {
        const banner = document.getElementById('sdml-preview-error');
        banner.textContent = 'Could not load reveal.js. Check network access and reload the preview.';
        banner.style.display = 'block';
    }
    vscode.postMessage({ type: 'ready' });
})();
</script>`;
    }
}
