const assert = require('assert');
const Module = require('module');
const vm = require('vm');
const path = require('path');
const { CompilerService } = require('../out/services/compiler-service');

const callbacks = {};
const listen = name => callback => {
    callbacks[name] = callback;
    return { dispose() { delete callbacks[name]; } };
};
const document = {
    languageId: 'slidedeck',
    fileName: '/tmp/slides/talk.sdml',
    uri: { scheme: 'file', fsPath: '/tmp/slides/talk.sdml', toString: () => 'file:///tmp/slides/talk.sdml' },
    version: 1,
    text: '# First\n===\n# Second',
    getText(range) { return range ? this.text.slice(range.start.offset, range.end.offset) : this.text; },
    positionAt(offset) { return { offset }; }
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
    WorkspaceEdit: class {
        constructor() { this.files = []; }
        replace(uri, range, text) { this.change = { uri, range, text }; }
        insert(uri, position, text) { this.change = { uri, range: { start: position, end: position }, text }; }
        createFile(uri, options) { this.files.push({ uri, options }); }
    },
    Uri: {
        file: file => ({ fsPath: file, toString: () => `file://${file}` }),
        joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts) })
    },
    EndOfLine: { CRLF: 2 },
    workspace: {
        isTrusted: true,
        workspaceFolders: [],
        onDidChangeTextDocument: listen('change'),
        applyEdit: async edit => {
            callbacks.lastEdit = edit;
            const { range, text } = edit.change;
            document.text = document.text.slice(0, range.start.offset) + text + document.text.slice(range.end.offset);
            document.version++;
            callbacks.change({ document });
            return true;
        }
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
    assert.ok(panel.webview.html.includes('worker-src blob:'));
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
    const reveal = { isReady: () => true, slide() {}, on() {}, getCurrentSlide: () => currentSlide };
    vm.runInNewContext(bridge, {
        acquireVsCodeApi: () => ({ postMessage: message => sent.push(message) }),
        window: { Reveal: reveal, addEventListener: (type, handler) => { handlers[type] = handler; } },
        document: { getElementById: () => null, addEventListener: (type, handler) => { handlers[type] = handler; } },
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

    const imagePath = path.join(__dirname, '../examples/templates/template2/assets/image_logo.png');
    document.text = `# First\n===\n::: {width: '50%'}\n![Logo](${imagePath})\n:::`;
    let fixtureSvg;
    if (process.env.SLIDEDECK_PREVIEW_TEST_HTML) {
        fixtureSvg = path.join(require('os').tmpdir(), `slidedeck-drawing-${process.pid}.svg`);
        const { annotationSvg } = require('../out/vscode/annotation');
        require('fs').writeFileSync(fixtureSvg, annotationSvg({
            tool: 'arrow', color: '#ff0000', width: 4, points: [{ x: 100, y: 120 }, { x: 320, y: 240 }]
        }, 960, 700));
    }
    document.text += `\n::: {animate: "fade-in"}\n::: {.sd-annotation-layer}\n![Annotation](${fixtureSvg || imagePath})\n:::\n:::`;
    document.version++;
    callbacks.change({ document });
    await sleep(600);
    const imageMatch = panel.webview.html.match(/data-sd-image="(\d+)"/);
    assert.ok(imageMatch);
    const imageId = Number(imageMatch[1]);
    const imageRevision = Number(panel.webview.html.match(/y: current\.y \+ delta\.y, slide: current\.index, revision: (\d+)/)[1]);
    if (process.env.SLIDEDECK_PREVIEW_TEST_HTML) {
        const html = panel.webview.html.replace('<head>', `<head><script>window.__messages=[]; window.acquireVsCodeApi=()=>({postMessage:m=>window.__messages.push(m)});</script>`);
        require('fs').writeFileSync(process.env.SLIDEDECK_PREVIEW_TEST_HTML, html);
    }
    callbacks.message({ type: 'layoutMode', enabled: true });
    callbacks.message({ type: 'resizeImage', id: imageId, width: 400, height: 200, slide: 1, revision: imageRevision });
    await sleep(0);
    assert.ok(document.text.includes("{size: '400px 200px'}"));
    await sleep(600);
    callbacks.message({ type: 'ready' });
    messages.pop();
    const resizedRevision = Number(panel.webview.html.match(/y: current\.y \+ delta\.y, slide: current\.index, revision: (\d+)/)[1]);
    callbacks.message({ type: 'moveImage', id: imageId, x: 25.25, y: -10, slide: 1, revision: resizedRevision });
    await sleep(0);
    assert.ok(document.text.includes("{offset: '25.3px -10px'}{size: '400px 200px'}"));
    callbacks.message({ type: 'moveImage', id: imageId, x: 30, y: 0, slide: 1, revision: resizedRevision });
    assert.match(callbacks.warning, /out of date/);
    await sleep(600);
    assert.ok(panel.webview.html.includes('translate: 25.3px -10px'));
    callbacks.message({ type: 'ready' });
    assert.deepStrictEqual(messages.pop(), { type: 'slide', index: 1 });
    assert.ok(panel.webview.html.includes('aria-pressed="true"'));
    const newRevision = Number(panel.webview.html.match(/y: current\.y \+ delta\.y, slide: current\.index, revision: (\d+)/)[1]);
    callbacks.message({ type: 'moveImage', id: imageId, x: -5, y: 8, slide: 1, revision: newRevision });
    await sleep(0);
    assert.ok(document.text.includes("{offset: '-5px 8px'}"));
    assert.strictEqual((document.text.match(/\{offset:/g) || []).length, 1);
    await sleep(600);
    callbacks.message({ type: 'ready' });
    messages.pop();
    const lastRevision = Number(panel.webview.html.match(/y: current\.y \+ delta\.y, slide: current\.index, revision: (\d+)/)[1]);
    const beforeInvalid = document.text;
    callbacks.message({ type: 'moveImage', id: imageId, x: 10001, y: 0, slide: 1, revision: lastRevision });
    assert.match(callbacks.warning, /10000/);
    callbacks.message({ type: 'layoutMode', enabled: false });
    callbacks.message({ type: 'moveImage', id: imageId, x: 0, y: 0, slide: 1, revision: lastRevision });
    assert.strictEqual(document.text, beforeInvalid);
    const blockId = Number(panel.webview.html.match(/data-sd-block="(\d+)"/)[1]);
    callbacks.message({ type: 'layoutMode', enabled: true });
    callbacks.message({ type: 'moveBlock', id: blockId, x: 12, y: 7, slide: 1, revision: lastRevision });
    await sleep(0);
    assert.ok(document.text.includes("width: '50%'; translate: '12px 7px'"));
    await sleep(600);
    callbacks.message({ type: 'ready' });
    messages.pop();
    const annotationId = Number(panel.webview.html.match(/class="sd-annotation-layer"[^>]*data-sd-block="(\d+)"/)[1]);
    const resizeRevision = Number(panel.webview.html.match(/height: drawingSize\.height, strokes, revision: (\d+)/)[1]);
    callbacks.message({ type: 'resizeAnnotation', id: annotationId, x: 1.5, y: 2, originX: 98, originY: 118, slide: 1, revision: resizeRevision });
    await sleep(0);
    assert.ok(document.text.includes("--sd-annotation-scale-x: '1.5'; --sd-annotation-scale-y: '2'; transform-origin: '98px 118px'"));
    callbacks.message({ type: 'resizeAnnotation', id: annotationId, x: 3, y: 3, originX: 98, originY: 118, slide: 1, revision: resizeRevision });
    assert.match(callbacks.warning, /out of date/);
    await sleep(600);
    assert.ok(panel.webview.html.includes('--sd-annotation-scale-x: 1.5'));
    callbacks.message({ type: 'ready' });
    messages.pop();
    let annotationRevision = Number(panel.webview.html.match(/height: drawingSize\.height, strokes, revision: (\d+)/)[1]);
    const beforeInvalidAnnotation = document.text;
    callbacks.message({ type: 'resizeAnnotation', id: annotationId, x: Infinity, y: 2, originX: 98, originY: 118, slide: 1, revision: annotationRevision });
    assert.match(callbacks.warning, /Invalid annotation dimensions/);
    assert.strictEqual(document.text, beforeInvalidAnnotation);
    callbacks.message({ type: 'moveBlock', id: annotationId, x: 20, y: -5, slide: 1, revision: annotationRevision });
    await sleep(0);
    assert.ok(document.text.includes("translate: '20px -5px'"));
    await sleep(600);
    callbacks.message({ type: 'ready' });
    messages.pop();
    annotationRevision = Number(panel.webview.html.match(/height: drawingSize\.height, strokes, revision: (\d+)/)[1]);
    if (process.env.SLIDEDECK_PREVIEW_RESIZED_TEST_HTML) {
        const html = panel.webview.html.replace('<head>', `<head><script>window.__messages=[]; window.acquireVsCodeApi=()=>({postMessage:m=>window.__messages.push(m)});</script>`);
        require('fs').writeFileSync(process.env.SLIDEDECK_PREVIEW_RESIZED_TEST_HTML, html);
    }
    callbacks.message({ type: 'resizeAnnotation', id: annotationId, x: 2, y: 3, originX: 98, originY: 118, slide: 1, revision: annotationRevision });
    await sleep(0);
    assert.ok(document.text.includes("translate: '20px -5px'"));
    assert.ok(document.text.includes("--sd-annotation-scale-x: '2'; --sd-annotation-scale-y: '3'"));
    assert.strictEqual((document.text.match(/--sd-annotation-scale-x:/g) || []).length, 1);
    await sleep(600);
    callbacks.message({ type: 'ready' });
    messages.pop();
    annotationRevision = Number(panel.webview.html.match(/height: drawingSize\.height, strokes, revision: (\d+)/)[1]);
    callbacks.message({ type: 'saveAnnotations', revision: annotationRevision, slide: 1, width: 960, height: 700,
        strokes: [{ tool: 'pen', color: '#ff0033', width: 4, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }] });
    await sleep(0);
    assert.strictEqual(callbacks.lastEdit.files.length, 1);
    assert.match(callbacks.lastEdit.files[0].uri.fsPath, /img\/annotation-[a-f0-9]{32}\.svg$/);
    assert.match(callbacks.lastEdit.files[0].options.contents.toString(), /<svg/);
    assert.match(document.text, /::: \{animate: "fade-in"\}\n::: \{\.sd-annotation-layer\}\n!\[Annotation\]/);
    assert.strictEqual(messages.pop().type, 'annotationsSaved');

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
    if (fixtureSvg) require('fs').unlinkSync(fixtureSvg);
    console.log('VS Code preview tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
