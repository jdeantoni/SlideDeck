import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';

const imageTypes: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg'
};
const imageExtensions = new Set(Object.values(imageTypes).concat('jpeg'));

export class ImagePasteProvider implements vscode.DocumentPasteEditProvider {
    constructor(private readonly kind: vscode.DocumentDropOrPasteEditKind) {}

    public async provideDocumentPasteEdits(
        document: vscode.TextDocument,
        ranges: readonly vscode.Range[],
        transfer: vscode.DataTransfer,
        _context: vscode.DocumentPasteEditContext,
        token: vscode.CancellationToken
    ): Promise<vscode.DocumentPasteEdit[] | undefined> {
        try {
            const images: { extension: string; data: Uint8Array }[] = [];
            for (const [mime, item] of transfer) {
                const file = item.asFile();
                if (!file) continue;
                const extension = imageTypes[mime.toLowerCase()] ??
                    path.extname(file.name).slice(1).toLowerCase();
                if (!imageExtensions.has(extension)) continue;
                images.push({ extension, data: await file.data() });
                break;
            }

            if (!images.length) {
                const uriList = transfer.get('text/uri-list');
                if (!uriList) return;
                const lines = (await uriList.asString()).split(/\r?\n/).filter(line => line && !line.startsWith('#'));
                if (!lines.length) return;
                const uris = lines.map(line => vscode.Uri.parse(line, true));
                if (uris.some(uri => !['file', 'vscode-remote'].includes(uri.scheme) ||
                    !imageExtensions.has(path.extname(uri.path).slice(1).toLowerCase()))) return;
                for (const uri of uris) {
                    images.push({
                        extension: path.extname(uri.path).slice(1).toLowerCase(),
                        data: await vscode.workspace.fs.readFile(uri)
                    });
                }
            }
            if (token.isCancellationRequested) return;
            if (document.uri.scheme !== 'file') {
                void vscode.window.showWarningMessage('Save the SlideDeckML file before pasting an image.');
                return;
            }

            const edit = new vscode.WorkspaceEdit();
            const imageDirectory = vscode.Uri.joinPath(document.uri, '..', 'img');
            const syntax = images.map(image => {
                const name = `image-${crypto.randomBytes(16).toString('hex')}.${image.extension}`;
                edit.createFile(vscode.Uri.joinPath(imageDirectory, name), { contents: image.data, overwrite: false });
                return `![Image](./img/${name})`;
            }).join('\n');

            const before = ranges.some(range => document.lineAt(range.start.line).text.slice(0, range.start.character).trim().length > 0);
            const after = ranges.some(range => document.lineAt(range.end.line).text.slice(range.end.character).trim().length > 0);
            const insertText = `${before ? '\n' : ''}${syntax}${after ? '\n' : ''}`;
            const paste = new vscode.DocumentPasteEdit(insertText, 'Insert SlideDeckML image', this.kind);
            paste.additionalEdit = edit;
            return [paste];
        } catch (error) {
            void vscode.window.showErrorMessage(`Could not paste image: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
    }
}

export function registerImagePaste(): vscode.Disposable | undefined {
    if (!vscode.languages.registerDocumentPasteEditProvider) {
        void vscode.window.showWarningMessage('Pasting images into SlideDeckML requires VS Code 1.97 or later.');
        return;
    }
    const kind = vscode.DocumentDropOrPasteEditKind.Empty.append('slidedeckml', 'image');
    return vscode.languages.registerDocumentPasteEditProvider(
        { language: 'slidedeckml' },
        new ImagePasteProvider(kind),
        { providedPasteEditKinds: [kind], pasteMimeTypes: ['image/*', 'files', 'text/uri-list'] }
    );
}
