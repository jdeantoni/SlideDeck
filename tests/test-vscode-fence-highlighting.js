const assert = require('assert');
const Module = require('module');
const callbacks = {};
const listen = name => callback => {
    callbacks[name] = callback;
    return { dispose() {} };
};
const document = {
    languageId: 'slidedeck',
    text: '::: {color: red}\n::: {color: blue}\n```js\n::: end\n```\n:::   end\n::: end',
    getText() { return this.text; },
    positionAt(offset) { return { offset }; }
};
const editor = {
    document,
    selections: [{ active: { offset: 1 } }],
    decorations: new Map(),
    setDecorations(type, ranges) { this.decorations.set(type.index, ranges); }
};
let next = 0;
const vscode = {
    Range: class {
        constructor(start, end) { this.start = start; this.end = end; }
        contains(position) { return position.offset >= this.start.offset && position.offset <= this.end.offset; }
    },
    ThemeColor: class { constructor(id) { this.id = id; } },
    Disposable: { from: (...items) => ({ dispose: () => items.forEach(item => item.dispose()) }) },
    window: {
        visibleTextEditors: [editor],
        createTextEditorDecorationType: () => ({ index: next++, dispose() {} }),
        onDidChangeTextEditorSelection: listen('selection'),
        onDidChangeVisibleTextEditors: listen('visible')
    },
    workspace: { onDidChangeTextDocument: listen('change') }
};
const originalLoad = Module._load;
Module._load = function(request, ...args) {
    if (request === 'vscode') return vscode;
    return originalLoad.call(this, request, ...args);
};
const { registerFenceHighlighting } = require('../out/vscode/fence-highlighting');
Module._load = originalLoad;

const disposable = registerFenceHighlighting();
assert.strictEqual(editor.decorations.get(0).length, 2);
assert.strictEqual(editor.decorations.get(1).length, 2);
assert.strictEqual(editor.decorations.get(6).length, 2);
const innerClosing = editor.decorations.get(1)[1];
assert.strictEqual(document.text.slice(innerClosing.start.offset, innerClosing.end.offset), ':::   end');
editor.selections = [{ active: { offset: innerClosing.start.offset + 2 } }];
callbacks.selection({ textEditor: editor });
assert.deepStrictEqual(editor.decorations.get(6), editor.decorations.get(1));
document.text = '::: {color: red}\nUnclosed';
callbacks.change({ document });
assert.strictEqual(editor.decorations.get(0).length, 0);
assert.strictEqual(editor.decorations.get(6).length, 0);
disposable.dispose();
console.log('VS Code fence highlighting tests passed');
