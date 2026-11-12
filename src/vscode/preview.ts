import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { CompilerService } from '../services/compiler-service';
import { getImageOffset, withImageOffset, withImageSize } from '../generator/image-position';
import { getBlockOffset, withBlockOffset, withAnnotationScale } from '../generator/block-position';
import { annotationSvg, validateAnnotations } from './annotation';

export class PreviewManager implements vscode.Disposable {
    private readonly panels = new Map<string, SlidePreview>();

    public open(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'slidedeck') {
            void vscode.window.showErrorMessage('Open a SlideDeck file before starting the preview.');
            return;
        }
        if (!vscode.workspace.isTrusted) {
            void vscode.window.showErrorMessage('Trust this workspace before opening a SlideDeck preview.');
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
    private slideEndOffsets: number[] = [];
    private disposed = false;
    private ready = false;
    private pendingError: string | undefined;
    private compiledVersion: number | undefined;
    private displayedRevision: number | undefined;
    private imageMappings = new Map<number, { start: number; end: number; content: string }>();
    private blockMappings = new Map<number, { start: number; end: number; content: string; style?: string }>();
    private layoutMode = false;
    private pendingSlide: number | undefined;
    private savingAnnotations = false;

    constructor(private readonly document: vscode.TextDocument, private readonly editorColumn: vscode.ViewColumn | undefined, onDispose: () => void) {
        const roots = (vscode.workspace.workspaceFolders || []).map(folder => folder.uri);
        if (document.uri.scheme === 'file') {
            roots.push(vscode.Uri.file(path.dirname(document.uri.fsPath)));
        }
        this.panel = vscode.window.createWebviewPanel(
            'slidedeck.preview',
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
                    if (this.pendingSlide !== undefined) {
                        void this.panel.webview.postMessage({ type: 'slide', index: this.pendingSlide });
                        this.pendingSlide = undefined;
                    } else {
                        this.updateSlide();
                    }
                    if (this.pendingError) this.showError(this.pendingError);
                } else if (message && message.type === 'revealSource') {
                    void this.revealSource(message.index, message.revision);
                } else if (message && message.type === 'layoutMode' && typeof message.enabled === 'boolean') {
                    this.layoutMode = message.enabled;
                } else if (message && message.type === 'moveImage') {
                    void this.moveElement(message, 'image');
                } else if (message && message.type === 'moveBlock') {
                    void this.moveElement(message, 'block');
                } else if (message && message.type === 'resizeImage') {
                    void this.resizeImage(message);
                } else if (message && message.type === 'resizeAnnotation') {
                    void this.resizeAnnotation(message);
                } else if (message && message.type === 'layoutError' && typeof message.text === 'string') {
                    void vscode.window.showWarningMessage(message.text);
                } else if (message && message.type === 'saveAnnotations') {
                    void this.saveAnnotations(message);
                }
            })
        );
        this.schedule();
    }

    private async resizeAnnotation(message: { revision: unknown; id: unknown; x: unknown; y: unknown; originX: unknown; originY: unknown; slide: unknown }): Promise<void> {
        if (!this.layoutMode || typeof message.id !== 'number' || !Number.isInteger(message.id) ||
            typeof message.slide !== 'number' || !Number.isInteger(message.slide) || message.slide < 0 ||
            message.slide >= this.startLines.length) return;
        if (message.revision !== this.displayedRevision || this.document.version !== this.compiledVersion) {
            void vscode.window.showWarningMessage('The preview is out of date. Wait for it to update before resizing an annotation.');
            return;
        }
        const values = [message.x, message.y, message.originX, message.originY];
        if (!values.every(value => typeof value === 'number' && Number.isFinite(value)) ||
            typeof message.x !== 'number' || typeof message.y !== 'number' ||
            typeof message.originX !== 'number' || typeof message.originY !== 'number' ||
            message.x < 0.01 || message.y < 0.01 || message.x > 100 || message.y > 100 ||
            Math.abs(message.originX) > 10000 || Math.abs(message.originY) > 10000) {
            void vscode.window.showWarningMessage('Invalid annotation dimensions.');
            return;
        }
        const mapping = this.blockMappings.get(message.id);
        if (!mapping) return;
        const range = new vscode.Range(this.document.positionAt(mapping.start), this.document.positionAt(mapping.end));
        if (this.document.getText(range) !== mapping.content) {
            void vscode.window.showWarningMessage('The annotation source has changed. Wait for the preview to update.');
            return;
        }
        try {
            const round = (value: number): number => Math.round(value * 1000) / 1000;
            const text = withAnnotationScale(mapping.content, mapping.style, {
                x: round(message.x), y: round(message.y),
                originX: round(message.originX), originY: round(message.originY)
            });
            const edit = new vscode.WorkspaceEdit();
            edit.replace(this.document.uri, range, text);
            this.pendingSlide = message.slide;
            if (!await vscode.workspace.applyEdit(edit)) {
                this.pendingSlide = undefined;
                void vscode.window.showErrorMessage('Could not update the annotation size in the source file.');
            }
        } catch (error) {
            this.pendingSlide = undefined;
            void vscode.window.showErrorMessage(`Could not resize the annotation: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async resizeImage(message: { revision: unknown; id: unknown; width: unknown; height: unknown; slide: unknown }): Promise<void> {
        if (!this.layoutMode || typeof message.id !== 'number' || !Number.isInteger(message.id) ||
            typeof message.width !== 'number' || !Number.isFinite(message.width) || message.width < 1 || message.width > 10000 ||
            typeof message.height !== 'number' || !Number.isFinite(message.height) || message.height < 1 || message.height > 10000 ||
            typeof message.slide !== 'number' || !Number.isInteger(message.slide) || message.slide < 0 ||
            message.slide >= this.startLines.length) return;
        if (message.revision !== this.displayedRevision || this.document.version !== this.compiledVersion) {
            void vscode.window.showWarningMessage('The preview is out of date. Wait for it to update before resizing an image.');
            return;
        }
        const mapping = this.imageMappings.get(message.id);
        if (!mapping) return;
        const range = new vscode.Range(this.document.positionAt(mapping.start), this.document.positionAt(mapping.end));
        if (this.document.getText(range) !== mapping.content) {
            void vscode.window.showWarningMessage('The image source has changed. Wait for the preview to update.');
            return;
        }
        const edit = new vscode.WorkspaceEdit();
        const width = Math.round(message.width * 10) / 10;
        const height = Math.round(message.height * 10) / 10;
        edit.replace(this.document.uri, range, withImageSize(mapping.content, width, height));
        try {
            this.pendingSlide = message.slide;
            if (!await vscode.workspace.applyEdit(edit)) {
                this.pendingSlide = undefined;
                void vscode.window.showErrorMessage('Could not update the image size in the source file.');
            }
        } catch (error) {
            this.pendingSlide = undefined;
            void vscode.window.showErrorMessage(`Could not update the image size: ${error instanceof Error ? error.message : String(error)}`);
        }
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
            const result = await new CompilerService().compile(source, undefined, sourcePath, { useUrlHash: false, previewImagePositions: true });
            if (this.disposed || revision !== this.revision) return;
            if (result.error) {
                this.showError(result.error);
                return;
            }
            this.startLines = result.slideStartLines || [];
            this.slideEndOffsets = result.slideEndOffsets || [];
            this.imageMappings = new Map((result.imageMappings || []).map(mapping => [mapping.start, mapping]));
            this.blockMappings = new Map((result.blockMappings || []).map(mapping => [mapping.start, mapping]));
            const html = this.previewHtml(result.html, revision, version);
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

    private async saveAnnotations(message: { revision: unknown; slide: unknown; width: unknown; height: unknown; strokes: unknown }): Promise<void> {
        const fail = (text: string): void => {
            void vscode.window.showWarningMessage(text);
            void this.panel.webview.postMessage({ type: 'annotationsSaveFailed' });
        };
        if (this.savingAnnotations) return;
        if (message.revision !== this.displayedRevision || this.document.version !== this.compiledVersion) {
            fail('The preview is out of date. Wait for it to update before saving annotations.');
            return;
        }
        if (this.document.uri.scheme !== 'file' || this.document.isUntitled) {
            fail('Save the SlideDeck file before saving annotations.');
            return;
        }
        if (typeof message.slide !== 'number' || !Number.isInteger(message.slide) ||
            message.slide < 0 || message.slide >= this.slideEndOffsets.length ||
            typeof message.width !== 'number' || !Number.isFinite(message.width) || message.width <= 0 || message.width > 10000 ||
            typeof message.height !== 'number' || !Number.isFinite(message.height) || message.height <= 0 || message.height > 10000 ||
            !validateAnnotations(message.strokes)) {
            fail('Cannot save invalid annotation data.');
            return;
        }
        const offset = this.slideEndOffsets[message.slide];
        if (offset < 0 || offset > this.document.getText().length) {
            fail('Cannot locate the slide source for these annotations.');
            return;
        }
        this.savingAnnotations = true;
        try {
            const edit = new vscode.WorkspaceEdit();
            const directory = vscode.Uri.joinPath(this.document.uri, '..', 'img');
            const newline = this.document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
            const width = message.width;
            const height = message.height;
            const fragments = message.strokes.map(stroke => {
                const name = `annotation-${crypto.randomBytes(16).toString('hex')}.svg`;
                edit.createFile(vscode.Uri.joinPath(directory, name), {
                    contents: Buffer.from(annotationSvg(stroke, width, height), 'utf8'),
                    overwrite: false
                });
                return ['::: {animate: "fade-in"}', '::: {.sd-annotation-layer}',
                    `![Annotation](./img/${name})`, ':::', ':::'].join(newline);
            });
            edit.insert(this.document.uri, this.document.positionAt(offset), newline + newline + fragments.join(newline + newline));
            this.pendingSlide = message.slide;
            if (!await vscode.workspace.applyEdit(edit)) {
                this.pendingSlide = undefined;
                fail('Could not save annotations in the source file.');
                return;
            }
            void this.panel.webview.postMessage({ type: 'annotationsSaved' });
        } catch (error) {
            this.pendingSlide = undefined;
            fail(`Could not save annotations: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.savingAnnotations = false;
        }
    }

    private async moveElement(message: { revision: unknown; id: unknown; x: unknown; y: unknown; slide: unknown }, kind: 'image' | 'block'): Promise<void> {
        if (!this.layoutMode || typeof message.id !== 'number' || !Number.isInteger(message.id) ||
            typeof message.x !== 'number' || !Number.isFinite(message.x) ||
            typeof message.y !== 'number' || !Number.isFinite(message.y) ||
            typeof message.slide !== 'number' || !Number.isInteger(message.slide) ||
            message.slide < 0 || message.slide >= this.startLines.length) return;
        if (message.revision !== this.displayedRevision || this.document.version !== this.compiledVersion) {
            void vscode.window.showWarningMessage('The preview is out of date. Wait for it to update before moving an element.');
            return;
        }
        if (Math.abs(message.x) > 10000 || Math.abs(message.y) > 10000) {
            void vscode.window.showWarningMessage('Element offsets must be within 10000 slide pixels.');
            return;
        }
        const mapping = kind === 'image' ? this.imageMappings.get(message.id) : this.blockMappings.get(message.id);
        if (!mapping) return;
        const range = new vscode.Range(this.document.positionAt(mapping.start), this.document.positionAt(mapping.end));
        if (this.document.getText(range) !== mapping.content) {
            void vscode.window.showWarningMessage('The element source has changed. Wait for the preview to update.');
            return;
        }
        const offset = { x: Math.round(message.x * 10) / 10, y: Math.round(message.y * 10) / 10 };
        const style = 'style' in mapping && typeof mapping.style === 'string' ? mapping.style : undefined;
        const previous = kind === 'image' ? getImageOffset(mapping.content) : getBlockOffset(style);
        if (!previous) return;
        if (previous.x === offset.x && previous.y === offset.y) return;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(this.document.uri, range, kind === 'image'
            ? withImageOffset(mapping.content, offset) : withBlockOffset(mapping.content, style, offset));
        try {
            this.pendingSlide = message.slide;
            if (!await vscode.workspace.applyEdit(edit)) {
                this.pendingSlide = undefined;
                void vscode.window.showErrorMessage('Could not update the element position in the source file.');
            }
        } catch (error) {
            this.pendingSlide = undefined;
            void vscode.window.showErrorMessage(`Could not update the element position: ${error instanceof Error ? error.message : String(error)}`);
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

    private previewHtml(html: string, revision: number, version: number): string {
        let base = '';
        if (this.document.uri.scheme === 'file') {
            const directory = vscode.Uri.file(path.dirname(this.document.uri.fsPath));
            const uri = this.panel.webview.asWebviewUri(directory).toString().replace(/\/?$/, '/');
            base = `<base href="${uri.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`;
        }
        const source = this.panel.webview.cspSource;
        const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https: http:; worker-src blob:; style-src 'unsafe-inline' https: http:; img-src ${source} data: https: http:; media-src ${source} data: blob: https: http:; font-src ${source} data: https: http:; connect-src ${source} https: http: ws: wss:; frame-src https: http: blob:;">`;
        const head = html.replace('<head>', `<head>${csp}${base}`);
        const end = head.lastIndexOf('</body>');
        if (end < 0) throw new Error('Generated presentation has no closing body tag.');
        return head.slice(0, end) + this.bridge(true, revision, version) + head.slice(end);
    }

    private bridge(presentation: boolean, revision: number, version?: number): string {
        return `<div id="sdml-preview-error" role="alert" style="display:none;position:fixed;top:0;left:0;right:0;z-index:99999;background:#822;color:white;padding:12px;white-space:pre-wrap"></div>
${presentation ? `<style>
body.sd-layout-mode :is(img[data-sd-image], [data-sd-block]) { cursor: move; outline: 2px dashed #19a7ff; outline-offset: 3px; touch-action: none; }
body.sd-layout-mode .sd-annotation-layer { outline: none; }
.sd-annotation-hit { position: fixed; z-index: 99990; box-sizing: border-box; border: 1px dashed #19a7ff; cursor: move; touch-action: none; }
.sd-annotation-handle { position: absolute; right: -7px; bottom: -7px; width: 14px; height: 14px; background: #007acc; border: 1px solid white; cursor: nwse-resize; }
#sd-resize-image { position: fixed; z-index: 99997; width: 14px; height: 14px; padding: 0; border: 1px solid white; background: #007acc; cursor: nwse-resize; touch-action: none; }
#sd-layout-toggle { position: fixed; top: 8px; right: 8px; z-index: 99998; padding: 6px 10px; background: #222; color: white; border: 1px solid #aaa; border-radius: 4px; cursor: pointer; }
#sd-layout-toggle[aria-pressed="true"] { background: #075b8d; }
#sd-annotation-toolbar { position: fixed; top: 42px; right: 8px; z-index: 99998; background: #222; color: white; padding: 6px; border-radius: 4px; display: flex; gap: 5px; align-items: center; }
#sd-annotation-toolbar button, #sd-annotation-toolbar select, #sd-annotation-toolbar input { font: 13px sans-serif; }
#sd-annotation-toolbar [hidden] { display: none; }
#sd-annotation-toolbar button[aria-pressed="true"] { background: #075b8d; color: white; }
.sd-annotation-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 9999; touch-action: none; }
</style><button id="sd-resize-image" type="button" hidden aria-label="Resize selected image" title="Drag to resize; hold Shift to preserve proportions"></button><button id="sd-layout-toggle" type="button" aria-pressed="${this.layoutMode}" title="Drag images or styled blocks; Shift-drag an image to move its surrounding block">Edit layout</button>
<div id="sd-annotation-toolbar"><button id="sd-draw-toggle" type="button" aria-pressed="false">Draw</button>
<span id="sd-draw-controls" hidden><label>Tool <select id="sd-draw-tool"><option value="pen">Pen</option><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="arrow">Arrow</option></select></label>
<label>Color <input id="sd-draw-color" type="color" value="#ff3333"></label>
<label>Width <input id="sd-draw-width" type="number" value="4" min="1" max="30" style="width: 46px"></label>
<button id="sd-draw-save" type="button">Save fragments</button><button id="sd-draw-clear" type="button">Clear</button></span></div>` : ''}
<script>
(() => {
    const vscode = acquireVsCodeApi();
    let slide = 0;
    let layoutMode = ${presentation && this.layoutMode};
    let drag = null;
    let selectedImage = null;
    let resize = null;
    let annotationDrag = null;
    const annotationBounds = new WeakMap();
    const annotationControls = new Map();
    let annotationRefresh = 0;
    async function getAnnotationBounds(layer) {
        if (annotationBounds.has(layer)) return annotationBounds.get(layer);
        const image = layer.querySelector('img');
        if (!image) throw new Error('Annotation image is missing.');
        await image.decode();
        const width = image.naturalWidth, height = image.naturalHeight;
        if (!width || !height || width * height > 16000000) throw new Error('Annotation image dimensions are unsupported.');
        const bitmap = document.createElement('canvas');
        bitmap.width = width; bitmap.height = height;
        const context = bitmap.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, width, height).data;
        let left = width, top = height, right = -1, bottom = -1;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if (pixels[(y * width + x) * 4 + 3] > 0) {
                left = Math.min(left, x); top = Math.min(top, y);
                right = Math.max(right, x); bottom = Math.max(bottom, y);
            }
        }
        if (right < left) throw new Error('Annotation image has no visible pixels.');
        const bounds = { left: left / width, top: top / height, width: (right - left + 1) / width, height: (bottom - top + 1) / height };
        annotationBounds.set(layer, bounds);
        return bounds;
    }
    function positionAnnotationControl(layer, control, bounds) {
        const rect = layer.getBoundingClientRect();
        control.style.left = (rect.left + bounds.left * rect.width) + 'px';
        control.style.top = (rect.top + bounds.top * rect.height) + 'px';
        control.style.width = Math.max(8, bounds.width * rect.width) + 'px';
        control.style.height = Math.max(8, bounds.height * rect.height) + 'px';
    }
    async function refreshAnnotationControls() {
        const refresh = ++annotationRefresh;
        for (const control of annotationControls.values()) control.remove();
        annotationControls.clear();
        const current = currentIndex();
        for (const layer of document.querySelectorAll('.reveal .slides > .sd-annotation-layer[data-sd-block]')) {
            if (!layoutMode || Number(layer.dataset.sdAnnotationSlide) !== current) continue;
            layer.style.display = 'block';
            try {
                const bounds = await getAnnotationBounds(layer);
                if (refresh !== annotationRefresh || !layoutMode || current !== currentIndex()) return;
                const control = document.createElement('div');
                control.className = 'sd-annotation-hit';
                control.title = 'Drag to move; drag the corner to resize (Shift preserves proportions)';
                const handle = document.createElement('div');
                handle.className = 'sd-annotation-handle';
                control.appendChild(handle);
                document.body.appendChild(control);
                annotationControls.set(layer, control);
                positionAnnotationControl(layer, control, bounds);
                control.addEventListener('pointerdown', event => {
                    if (event.button !== 0) return;
                    const rect = control.getBoundingClientRect();
                    const scales = getComputedStyle(layer).scale;
                    const parts = scales === 'none' ? [1, 1] : scales.split(' ').map(Number);
                    const existingOrigin = layer.style.transformOrigin;
                    const origin = existingOrigin ? existingOrigin.split(' ').map(parseFloat) :
                        [bounds.left * layer.offsetWidth, bounds.top * layer.offsetHeight];
                    annotationDrag = { pointer: event.pointerId, layer, control, bounds, startX: event.clientX, startY: event.clientY,
                        x: Number(layer.dataset.sdX), y: Number(layer.dataset.sdY), slide: current,
                        scaleX: parts[0], scaleY: parts[1] ?? parts[0], originX: origin[0], originY: origin[1],
                        width: rect.width, height: rect.height, resizing: event.target === handle, moved: false,
                        previousTranslate: layer.style.translate, previousScale: layer.style.scale,
                        previousOrigin: layer.style.transformOrigin };
                    control.setPointerCapture(event.pointerId);
                    event.preventDefault(); event.stopPropagation();
                });
            } catch (error) {
                if (refresh !== annotationRefresh) return;
                vscode.postMessage({ type: 'layoutError', text: 'Cannot edit annotation: ' + String(error) });
            }
        }
    }
    const resizeHandle = document.getElementById('sd-resize-image');
    function updateResizeHandle() {
        if (!resizeHandle || !selectedImage || !layoutMode || !selectedImage.isConnected) {
            if (resizeHandle) resizeHandle.hidden = true;
            return;
        }
        const rect = selectedImage.getBoundingClientRect();
        resizeHandle.style.left = (rect.right - 7) + 'px';
        resizeHandle.style.top = (rect.bottom - 7) + 'px';
        resizeHandle.hidden = false;
    }
    let drawingMode = false;
    const toggle = document.getElementById('sd-layout-toggle');
    if (toggle) {
        document.body.classList.toggle('sd-layout-mode', layoutMode);
        toggle.addEventListener('click', () => {
            if (drawingMode) return;
            layoutMode = !layoutMode;
            if (!layoutMode) selectedImage = null;
            updateResizeHandle();
            document.body.classList.toggle('sd-layout-mode', layoutMode);
            if (!layoutMode && window.sdUpdateAnnotationLayers) window.sdUpdateAnnotationLayers();
            void refreshAnnotationControls();
            toggle.setAttribute('aria-pressed', String(layoutMode));
            vscode.postMessage({ type: 'layoutMode', enabled: layoutMode });
        });
    }
    const drawToggle = document.getElementById('sd-draw-toggle');
    const drawControls = document.getElementById('sd-draw-controls');
    const drawTool = document.getElementById('sd-draw-tool');
    const drawColor = document.getElementById('sd-draw-color');
    const drawWidth = document.getElementById('sd-draw-width');
    const drawSave = document.getElementById('sd-draw-save');
    const drawClear = document.getElementById('sd-draw-clear');
    let drawing = null;
    let canvas = null;
    let sketch = null;
    let strokes = [];
    let drawingSlide = null;
    let drawingSize = null;
    let drawingVersion = ${version ?? -1};
    let saving = false;
    const savedSketch = typeof vscode.getState === 'function' ? vscode.getState() : null;
    if (savedSketch && Array.isArray(savedSketch.strokes) && savedSketch.strokes.length) {
        strokes = savedSketch.strokes;
        drawingSlide = savedSketch.slide;
        drawingSize = savedSketch.size;
        drawingVersion = savedSketch.version;
    }
    function persistSketch() {
        if (typeof vscode.setState === 'function') vscode.setState(strokes.length ?
            { strokes, slide: drawingSlide, size: drawingSize, version: drawingVersion } : null);
    }
    function renderSketch() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const stroke of sketch ? strokes.concat([sketch]) : strokes) {
            const first = stroke.points[0], last = stroke.points[stroke.points.length - 1];
            ctx.beginPath();
            ctx.lineWidth = stroke.width; ctx.strokeStyle = stroke.color;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (stroke.tool === 'rectangle') {
                ctx.rect(first.x, first.y, last.x - first.x, last.y - first.y);
            } else if (stroke.tool === 'ellipse') {
                ctx.ellipse((first.x + last.x) / 2, (first.y + last.y) / 2,
                    Math.abs(last.x - first.x) / 2, Math.abs(last.y - first.y) / 2, 0, 0, Math.PI * 2);
            } else {
                ctx.moveTo(first.x, first.y);
                for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                if (stroke.tool === 'arrow') {
                    const angle = Math.atan2(last.y - first.y, last.x - first.x), size = Math.max(12, stroke.width * 4);
                    ctx.lineTo(last.x - size * Math.cos(angle - 0.45), last.y - size * Math.sin(angle - 0.45));
                    ctx.moveTo(last.x, last.y);
                    ctx.lineTo(last.x - size * Math.cos(angle + 0.45), last.y - size * Math.sin(angle + 0.45));
                }
            }
            ctx.stroke();
        }
    }
    function clearSketch() {
        strokes = []; sketch = null; drawing = null; drawingSlide = null; drawingSize = null;
        drawingVersion = ${version ?? -1};
        persistSketch();
        if (canvas) canvas.remove();
        canvas = null;
    }
    function currentIndex() {
        const current = window.Reveal && Reveal.isReady() && Reveal.getCurrentSlide();
        const value = current && current.getAttribute('data-slide-index');
        return value !== null && /^\\d+$/.test(value) ? Number(value) : null;
    }
    function makeCanvas() {
        const current = Reveal.getCurrentSlide(), index = currentIndex();
        const slides = document.querySelector('.reveal .slides');
        if (!current || index === null) return false;
        if (drawingSlide !== null && drawingSlide !== index) {
            vscode.postMessage({ type: 'layoutError', text: 'Return to the annotated slide to save or clear its drawings.' });
            return false;
        }
        if (!canvas) {
            const width = slides.clientWidth, height = slides.clientHeight;
            if (!width || !height) return false;
            canvas = document.createElement('canvas');
            canvas.className = 'sd-annotation-canvas';
            canvas.width = drawingSize ? drawingSize.width : width;
            canvas.height = drawingSize ? drawingSize.height : height;
            drawingSlide = index; drawingSize = drawingSize || { width, height };
            slides.appendChild(canvas);
        }
        canvas.style.display = 'block';
        canvas.style.pointerEvents = drawingMode ? 'auto' : 'none';
        renderSketch();
        return true;
    }
    if (drawToggle) {
        drawToggle.addEventListener('click', () => {
            if (saving || !window.Reveal || !Reveal.isReady()) return;
            if (!drawingMode && layoutMode) toggle.click();
            drawingMode = !drawingMode;
            drawToggle.setAttribute('aria-pressed', String(drawingMode));
            drawControls.hidden = !drawingMode;
            if (drawingMode && !makeCanvas()) {
                drawingMode = false; drawToggle.setAttribute('aria-pressed', 'false'); drawControls.hidden = true;
            } else if (canvas) canvas.style.pointerEvents = drawingMode ? 'auto' : 'none';
        });
        drawClear.addEventListener('click', () => {
            if (saving) return;
            clearSketch();
            if (drawingMode) makeCanvas();
        });
        drawSave.addEventListener('click', () => {
            if (saving || !strokes.length) return;
            if (drawingSlide !== currentIndex()) {
                vscode.postMessage({ type: 'layoutError', text: 'Return to the annotated slide before saving.' });
                return;
            }
            if (drawingVersion !== ${version ?? -1}) {
                vscode.postMessage({ type: 'layoutError', text: 'The source changed while you were drawing. Clear the drawings and try again.' });
                return;
            }
            saving = true;
            vscode.postMessage({ type: 'saveAnnotations', slide: drawingSlide, width: drawingSize.width,
                height: drawingSize.height, strokes, revision: ${revision} });
        });
    }
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
        } else if (message.type === 'annotationsSaved') {
            saving = false; clearSketch();
        } else if (message.type === 'annotationsSaveFailed') {
            saving = false;
        }
    });
    document.addEventListener('dblclick', event => {
        if (!window.Reveal || !Reveal.isReady() || !(event.target instanceof Element)) return;
        if (layoutMode && event.target.closest('img[data-sd-image], [data-sd-block]')) return;
        const current = Reveal.getCurrentSlide();
        if (!current || !current.contains(event.target) ||
            event.target.closest('a, button, input, textarea, select, video, audio, canvas, [contenteditable], [role="button"], .monaco-editor')) return;
        const attribute = current.getAttribute('data-slide-index');
        if (attribute === null || !/^\\d+$/.test(attribute)) return;
        const index = Number(attribute);
        if (Number.isInteger(index) && index >= 0) vscode.postMessage({ type: 'revealSource', index, revision: ${revision} });
    });
    document.addEventListener('pointerdown', event => {
        if (layoutMode && event.target === resizeHandle && selectedImage && event.button === 0) {
            const rect = selectedImage.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            resize = { pointer: event.pointerId, image: selectedImage, startX: event.clientX, startY: event.clientY,
                width: selectedImage.offsetWidth, height: selectedImage.offsetHeight,
                scaleX: selectedImage.offsetWidth / rect.width, scaleY: selectedImage.offsetHeight / rect.height,
                oldWidth: selectedImage.style.width, oldHeight: selectedImage.style.height,
                oldMaxWidth: selectedImage.style.maxWidth, oldMaxHeight: selectedImage.style.maxHeight,
                slide: currentIndex(), moved: false };
            resizeHandle.setPointerCapture(event.pointerId);
            event.preventDefault(); event.stopPropagation(); return;
        }
        if (drawingMode && canvas && event.target === canvas && event.button === 0 && !saving) {
            const rect = canvas.getBoundingClientRect();
            const point = { x: (event.clientX - rect.left) * canvas.width / rect.width,
                y: (event.clientY - rect.top) * canvas.height / rect.height };
            const width = Number(drawWidth.value);
            if (!Number.isFinite(width) || width < 1 || width > 30) {
                vscode.postMessage({ type: 'layoutError', text: 'Pen width must be between 1 and 30.' }); return;
            }
            sketch = { tool: drawTool.value, color: drawColor.value, width, points: [point, point] };
            drawing = event.pointerId;
            canvas.setPointerCapture(event.pointerId);
            event.preventDefault(); event.stopPropagation(); return;
        }
        if (!layoutMode || event.button !== 0 || !(event.target instanceof Element) || !window.Reveal || !Reveal.isReady()) return;
        const image = event.shiftKey ? event.target.closest('[data-sd-block]') :
            event.target.closest('img[data-sd-image], [data-sd-block]');
        const current = Reveal.getCurrentSlide();
        if (!image || !current || !current.contains(image)) return;
        selectedImage = image.matches('img[data-sd-image]') ? image : null;
        updateResizeHandle();
        const index = Number(current.getAttribute('data-slide-index'));
        if (!Number.isInteger(index) || index < 0) return;
        let matrix = new DOMMatrix();
        for (let parent = image.parentElement; parent; parent = parent.parentElement) {
            const transform = getComputedStyle(parent).transform;
            if (transform && transform !== 'none') matrix = new DOMMatrix(transform).multiply(matrix);
        }
        if (!matrix.is2D || !Number.isFinite(matrix.a * matrix.d - matrix.b * matrix.c) ||
            Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 0.000001) {
            vscode.postMessage({ type: 'layoutError', text: 'Cannot move an element inside a 3D or non-invertible transform.' });
            return;
        }
        drag = { image, pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
            x: Number(image.dataset.sdX), y: Number(image.dataset.sdY), inverse: matrix.inverse(), index,
            previous: image.style.translate, moved: false };
        image.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
    });
    document.addEventListener('pointermove', event => {
        if (annotationDrag && annotationDrag.pointer === event.pointerId) {
            const a = annotationDrag;
            const dx = event.clientX - a.startX, dy = event.clientY - a.startY;
            if (Math.hypot(dx, dy) < 3 && !a.moved) return;
            a.moved = true;
            if (a.resizing) {
                const sx = Math.max(0.01, a.scaleX * (1 + dx / a.width));
                const sy = event.shiftKey ? a.scaleY * sx / a.scaleX : Math.max(0.01, a.scaleY * (1 + dy / a.height));
                a.layer.style.transformOrigin = a.originX + 'px ' + a.originY + 'px';
                a.layer.style.scale = sx + ' ' + sy;
            } else {
                const slides = document.querySelector('.reveal .slides');
                const rect = slides.getBoundingClientRect();
                a.layer.style.translate = (a.x + dx * slides.clientWidth / rect.width) + 'px ' +
                    (a.y + dy * slides.clientHeight / rect.height) + 'px';
            }
            positionAnnotationControl(a.layer, a.control, a.bounds);
            event.preventDefault(); event.stopPropagation(); return;
        }
        if (resize && resize.pointer === event.pointerId) {
            let width = Math.max(1, resize.width + (event.clientX - resize.startX) * resize.scaleX);
            let height = Math.max(1, resize.height + (event.clientY - resize.startY) * resize.scaleY);
            if (event.shiftKey) height = width * resize.height / resize.width;
            resize.image.style.width = width + 'px'; resize.image.style.height = height + 'px';
            resize.image.style.maxWidth = 'none'; resize.image.style.maxHeight = 'none';
            resize.moved = true; updateResizeHandle(); event.preventDefault(); event.stopPropagation(); return;
        }
        if (drawing === event.pointerId && sketch && canvas) {
            const rect = canvas.getBoundingClientRect();
            const point = { x: (event.clientX - rect.left) * canvas.width / rect.width,
                y: (event.clientY - rect.top) * canvas.height / rect.height };
            if (sketch.tool === 'pen' && sketch.points.length < 2000) sketch.points.push(point);
            else sketch.points[sketch.points.length - 1] = point;
            renderSketch(); event.preventDefault(); event.stopPropagation(); return;
        }
        if (!drag || drag.pointer !== event.pointerId) return;
        const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
        if (Math.hypot(dx, dy) < 3 && !drag.moved) return;
        drag.moved = true;
        const delta = new DOMPoint(dx, dy, 0, 0).matrixTransform(drag.inverse);
        drag.image.style.translate = (drag.x + delta.x) + 'px ' + (drag.y + delta.y) + 'px';
        updateResizeHandle();
        event.preventDefault();
        event.stopPropagation();
    });
    function finishDrag(event, cancelled) {
        if (annotationDrag && annotationDrag.pointer === event.pointerId) {
            const a = annotationDrag; annotationDrag = null;
            const scale = a.layer.style.scale.split(' ').map(Number);
            const translate = a.layer.style.translate.split(' ').map(parseFloat);
            a.layer.style.translate = a.previousTranslate; a.layer.style.scale = a.previousScale;
            a.layer.style.transformOrigin = a.previousOrigin;
            positionAnnotationControl(a.layer, a.control, a.bounds);
            if (!cancelled && a.moved) {
                if (a.resizing) vscode.postMessage({ type: 'resizeAnnotation', id: Number(a.layer.dataset.sdBlock),
                    x: scale[0], y: scale[1], originX: a.originX, originY: a.originY, slide: a.slide, revision: ${revision} });
                else vscode.postMessage({ type: 'moveBlock', id: Number(a.layer.dataset.sdBlock),
                    x: translate[0], y: translate[1], slide: a.slide, revision: ${revision} });
            }
            event.preventDefault(); event.stopPropagation(); return;
        }
        if (resize && resize.pointer === event.pointerId) {
            const current = resize;
            resize = null;
            const width = current.image.offsetWidth, height = current.image.offsetHeight;
            current.image.style.width = current.oldWidth; current.image.style.height = current.oldHeight;
            current.image.style.maxWidth = current.oldMaxWidth; current.image.style.maxHeight = current.oldMaxHeight;
            updateResizeHandle();
            if (!cancelled && current.moved) vscode.postMessage({ type: 'resizeImage',
                id: Number(current.image.dataset.sdImage), width, height, slide: current.slide, revision: ${revision} });
            event.preventDefault(); event.stopPropagation(); return;
        }
        if (drawing === event.pointerId && sketch) {
            if (!cancelled && strokes.length < 100) { strokes.push(sketch); persistSketch(); }
            else if (!cancelled) vscode.postMessage({ type: 'layoutError', text: 'Save at most 100 drawings at a time.' });
            sketch = null; drawing = null; renderSketch();
            event.preventDefault(); event.stopPropagation(); return;
        }
        if (!drag || drag.pointer !== event.pointerId) return;
        const current = drag;
        drag = null;
        current.image.style.translate = current.previous;
        if (!cancelled && current.moved) {
            const delta = new DOMPoint(event.clientX - current.startX, event.clientY - current.startY, 0, 0).matrixTransform(current.inverse);
            vscode.postMessage({ type: current.image.dataset.sdImage !== undefined ? 'moveImage' : 'moveBlock',
                id: Number(current.image.dataset.sdImage ?? current.image.dataset.sdBlock),
                x: current.x + delta.x, y: current.y + delta.y, slide: current.index, revision: ${revision} });
        }
        event.preventDefault();
        event.stopPropagation();
    }
    document.addEventListener('pointerup', event => finishDrag(event, false));
    document.addEventListener('pointercancel', event => finishDrag(event, true));
    document.addEventListener('dragstart', event => {
        if (layoutMode && event.target instanceof Element && event.target.closest('img[data-sd-image]')) event.preventDefault();
    });
    if (window.Reveal) {
        document.addEventListener('sd-annotations-changed', () => { void refreshAnnotationControls(); });
        window.addEventListener('resize', () => { void refreshAnnotationControls(); });
        if (Reveal.isReady()) navigate();
        else Reveal.on('ready', navigate);
        Reveal.on('slidechanged', () => {
            if (drawingSlide !== currentIndex()) {
                if (drawingMode) {
                    drawingMode = false;
                    drawToggle.setAttribute('aria-pressed', 'false');
                    drawControls.hidden = true;
                }
                if (!strokes.length) clearSketch();
                else if (canvas) { canvas.style.pointerEvents = 'none'; canvas.style.display = 'none'; }
            } else if (canvas) {
                canvas.style.display = 'block';
            }
        });
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
