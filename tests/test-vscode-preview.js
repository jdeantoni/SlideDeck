const assert = require('assert');
const Module = require('module');
const vm = require('vm');
const { CompilerService } = require('../out/services/compiler-service');

const callbacks = {};
const listen = name => callback => {
    callbacks[name] = callback;
    return { dispose() { delete callbacks[name]; } };
};
const document = {
    languageId: 'slidedeckml',
    fileName: '/tmp/slides/talk.sdml',
    uri: { scheme: 'file', fsPath: '/tmp/slides/talk.sdml', toString: () => 'file:///tmp/slides/talk.sdml' },
    version: 1,
    text: '# First\n===\n# Second',
    getText() { return this.text; }
};
const editor = { document, viewColumn: 1, selection: { active: { line: 0 } }, revealRange(range) { this.revealedRange = range; } };
const messages = [];
let panel;
const vscode = {
    ViewColumn: { Beside: -2 },
    TextEditorRevealType: { InCenterIfOutsideViewport: 1 },
    Position: class { constructor(line, character) { this.line = line; this.character = character; } },
    Selection: class { constructor(start, end) { this.start = start; this.end = end; this.active = end; } },
    Range: class { constructor(start, end) { this.start = start; this.end = end; } },
    Uri: { file: file => ({ fsPath: file, toString: () => `file://${file}` }) },
    workspace: {
        isTrusted: true,
        workspaceFolders: [],
        onDidChangeTextDocument: listen('change')
    },
    window: {
        activeTextEditor: editor,
        visibleTextEditors: [editor],
        showErrorMessage: message => { callbacks.error = message; },
        showWarningMessage: message => { callbacks.warning = message; },
        showTextDocument: async (doc, options) => { callbacks.open = { doc, options }; return editor; },
        onDidChangeTextEditorSelection: listen('selection'),
        createWebviewPanel: (type, title, column, options) => {
            panel = {
                options,
                webview: {
                    cspSource: 'https://webview.example',
                    html: '',
                    postMessage: message => { messages.push(message); return Promise.resolve(true); },
                    asWebviewUri: uri => ({ toString: () => `https://webview.example${uri.fsPath}` }),
                    onDidReceiveMessage: listen('message')
                },
                onDidDispose: listen('dispose'),
                reveal: () => { panel.revealed = true; },
                dispose() {}
            };
            return panel;
        }
    }
};

const originalLoad = Module._load;
Module._load = function(request, ...args) {
    if (request === 'vscode') return vscode;
    return originalLoad.call(this, request, ...args);
};
const { PreviewManager } = require('../out/vscode/preview');
Module._load = originalLoad;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const manager = new PreviewManager();
    manager.open();
    assert.ok(panel.options.enableScripts);
    assert.strictEqual(panel.options.localResourceRoots[0].fsPath, '/tmp/slides');
    await sleep(600);
    assert.ok(panel.webview.html.includes('<h1>First</h1>'));
    assert.ok(panel.webview.html.includes('<base href="https://webview.example/tmp/slides/">'));
    assert.ok(panel.webview.html.includes('Content-Security-Policy'));
    assert.match(panel.webview.html, /Reveal\.initialize\(\{\s*hash: false,/);
    const standalone = await new CompilerService().compile(document.text);
    assert.match(standalone.html, /Reveal\.initialize\(\{\s*hash: true,/);
    callbacks.message({ type: 'ready' });
    assert.deepStrictEqual(messages.pop(), { type: 'slide', index: 0 });

    const bridge = panel.webview.html.match(/<script>\s*\(\(\) => \{\s*const vscode = acquireVsCodeApi\(\);[\s\S]*?<\/script>/)[0]
        .replace(/^<script>/, '').replace(/<\/script>$/, '');
    const handlers = {};
    const sent = [];
    class Element {
        constructor(interactive = false) { this.interactive = interactive; }
        closest() { return this.interactive ? this : null; }
    }
    const currentSlide = { contains: target => target.inside !== false, getAttribute: () => '1' };
    const reveal = { isReady: () => true, slide() {}, getCurrentSlide: () => currentSlide };
    vm.runInNewContext(bridge, {
        acquireVsCodeApi: () => ({ postMessage: message => sent.push(message) }),
        window: { Reveal: reveal, addEventListener: (type, handler) => { handlers[type] = handler; } },
        document: { addEventListener: (type, handler) => { handlers[type] = handler; } },
        Reveal: reveal,
        Element
    });
    handlers.dblclick({ target: new Element(true) });
    const outside = new Element(); outside.inside = false;
    handlers.dblclick({ target: outside });
    assert.strictEqual(sent.length, 1);
    handlers.dblclick({ target: new Element() });
    const navigation = sent[1];
    assert.strictEqual(navigation.type, 'revealSource');
    assert.strictEqual(navigation.index, 1);
    callbacks.message(navigation);
    await sleep(0);
    assert.strictEqual(editor.selection.active.line, 2);
    assert.strictEqual(editor.revealedRange.start.line, 2);
    assert.strictEqual(callbacks.open.options.viewColumn, 1);
    assert.strictEqual(callbacks.open.options.preserveFocus, false);
    callbacks.open = undefined;
    callbacks.message({ type: 'revealSource', index: -1, revision: navigation.revision });
    callbacks.message({ type: 'revealSource', index: 50, revision: navigation.revision });
    callbacks.message({ type: 'revealSource', index: '1', revision: navigation.revision });
    callbacks.message({ type: 'revealSource', index: 1, revision: navigation.revision - 1 });
    assert.strictEqual(callbacks.open, undefined);

    editor.selection.active.line = 2;
    callbacks.selection({ textEditor: editor, selections: [editor.selection] });
    assert.deepStrictEqual(messages.pop(), { type: 'slide', index: 1 });
    manager.open();
    assert.ok(panel.revealed);

    document.text = '# Unsaved\n===\n# Changed';
    document.version++;
    callbacks.change({ document });
    callbacks.message(navigation);
    assert.match(callbacks.warning, /out of date/);
    await sleep(600);
    assert.ok(panel.webview.html.includes('<h1>Unsaved</h1>'));
    callbacks.message({ type: 'ready' });
    assert.deepStrictEqual(messages.pop(), { type: 'slide', index: 1 });
    callbacks.warning = undefined;
    callbacks.message(navigation);
    assert.strictEqual(callbacks.open, undefined);
    assert.strictEqual(callbacks.warning, undefined);

    const previousHtml = panel.webview.html;
    document.text = '{\nauthor: "Broken"';
    document.version++;
    callbacks.change({ document });
    await sleep(600);
    assert.strictEqual(panel.webview.html, previousHtml);
    assert.strictEqual(messages.pop().type, 'error');

    const originalCompile = CompilerService.prototype.compile;
    CompilerService.prototype.compile = async function(source, ...args) {
        if (source.includes('Slow')) await sleep(700);
        return originalCompile.call(this, source, ...args);
    };
    try {
        document.text = '# Slow';
        document.version++;
        callbacks.change({ document });
        await sleep(400);
        document.text = '# Newest';
        document.version++;
        callbacks.change({ document });
        await sleep(1200);
        assert.ok(panel.webview.html.includes('<h1>Newest</h1>'));
        assert.ok(!panel.webview.html.includes('<h1>Slow</h1>'));
    } finally {
        CompilerService.prototype.compile = originalCompile;
        manager.dispose();
    }

    vscode.workspace.isTrusted = false;
    const untrusted = new PreviewManager();
    untrusted.open();
    assert.match(callbacks.error, /Trust this workspace/);
    untrusted.dispose();
    console.log('VS Code preview tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
