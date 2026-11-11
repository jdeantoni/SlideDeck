const assert = require('assert');
const Module = require('module');
const path = require('path');

const notices = [];
const files = new Map([
    ['file:///tmp/picture one.jpeg', Uint8Array.from([1, 2])],
    ['file:///tmp/picture.gif', Uint8Array.from([3])]
]);
const uri = (scheme, uriPath) => ({ scheme, path: uriPath });
const vscode = {
    Uri: {
        parse: value => {
            const parsed = new URL(value);
            return uri(parsed.protocol.slice(0, -1), decodeURIComponent(parsed.pathname));
        },
        joinPath: (base, ...parts) => uri(base.scheme, path.posix.join(base.path, ...parts))
    },
    workspace: {
        fs: {
            readFile: async value => {
                const bytes = files.get(`${value.scheme}://${value.path}`);
                if (!bytes) throw new Error('Cannot read image');
                return bytes;
            }
        }
    },
    window: {
        showWarningMessage: message => notices.push(message),
        showErrorMessage: message => notices.push(message)
    },
    WorkspaceEdit: class {
        constructor() { this.created = []; }
        createFile(target, options) { this.created.push({ target, options }); }
    },
    DocumentPasteEdit: class {
        constructor(insertText, title, kind) { Object.assign(this, { insertText, title, kind }); }
    }
};
const originalLoad = Module._load;
Module._load = function(request, ...args) {
    return request === 'vscode' ? vscode : originalLoad.call(this, request, ...args);
};
const { ImagePasteProvider } = require('../out/vscode/image-paste');
Module._load = originalLoad;

const provider = new ImagePasteProvider({ value: 'image' });
const token = { isCancellationRequested: false };
const document = {
    uri: uri('file', '/tmp/talk/slides.sdml'),
    lineAt: () => ({ text: 'BeforeAfter' })
};
const range = { start: { line: 0, character: 6 }, end: { line: 0, character: 6 } };
const item = data => ({ asFile: () => ({ name: 'screenshot', data: async () => data }) });

async function main() {
    const data = Uint8Array.from([1, 2, 3]);
    const first = (await provider.provideDocumentPasteEdits(
        document, [range], new Map([['image/png', item(data)]]), {}, token
    ))[0];
    assert.match(first.insertText, /^\n!\[Image\]\(\.\/img\/image-[a-f0-9]{32}\.png\)\n$/);
    assert.strictEqual(first.additionalEdit.created[0].target.path, `/tmp/talk/img/${first.insertText.match(/image-[a-f0-9]{32}\.png/)[0]}`);
    assert.strictEqual(first.additionalEdit.created[0].options.overwrite, false);
    assert.deepStrictEqual(first.additionalEdit.created[0].options.contents, data);
    const second = (await provider.provideDocumentPasteEdits(
        document, [range], new Map([['image/png', item(data)]]), {}, token
    ))[0];
    assert.notStrictEqual(first.insertText, second.insertText);

    const uris = { asFile: () => undefined, asString: async () => 'file:///tmp/picture%20one.jpeg\r\nfile:///tmp/picture.gif' };
    const multi = (await provider.provideDocumentPasteEdits(document, [range], new Map([['text/uri-list', uris]]), {}, token))[0];
    assert.strictEqual(multi.additionalEdit.created.length, 2);
    assert.match(multi.insertText, /\.jpeg\)\n!\[Image\]\(\.\/img\/image-[a-f0-9]{32}\.gif\)/);
    assert.strictEqual(await provider.provideDocumentPasteEdits(document, [range], new Map([['text/plain', {}]]), {}, token), undefined);
    assert.strictEqual(await provider.provideDocumentPasteEdits(document, [range], new Map([['image/png', item(data)]]), {}, { isCancellationRequested: true }), undefined);
    const webUri = { asFile: () => undefined, asString: async () => 'https://example.com/image.png' };
    assert.strictEqual(await provider.provideDocumentPasteEdits(document, [range], new Map([['text/uri-list', webUri]]), {}, token), undefined);
    const unsaved = { ...document, uri: uri('untitled', '/Untitled-1') };
    assert.strictEqual(await provider.provideDocumentPasteEdits(unsaved, [range], new Map([['image/png', item(data)]]), {}, token), undefined);
    assert.match(notices.pop(), /Save the SlideDeck file/);
    const bad = { asFile: () => ({ name: 'bad.png', data: async () => { throw new Error('Clipboard failed'); } }) };
    assert.strictEqual(await provider.provideDocumentPasteEdits(document, [range], new Map([['image/png', bad]]), {}, token), undefined);
    assert.match(notices.pop(), /Clipboard failed/);
    console.log('VS Code image paste tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
