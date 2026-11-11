const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdml-compile-'));
const sourcePath = path.join(dir, 'talk.slidedeck');
const outputPath = path.join(dir, 'talk.html');
const videoPath = path.join(dir, 'demo.mp4');
const assetDir = path.join(dir, 'talk-assets');
const aliasPath = path.join(dir, 'source-alias.html');
const uri = file => ({ scheme: 'file', fsPath: file });
const document = {
    languageId: 'slidedeck',
    uri: uri(sourcePath),
    text: '# Unsaved changes\n![Video](./demo.mp4)',
    getText() { return this.text; }
};
let selected = uri(outputPath);
const notices = { errors: [], info: [] };
const vscode = {
    Uri: { file: uri },
    workspace: { isTrusted: true },
    window: {
        activeTextEditor: { document },
        showSaveDialog: async options => { notices.options = options; return selected; },
        showErrorMessage: message => notices.errors.push(message),
        showInformationMessage: message => notices.info.push(message)
    }
};

const originalLoad = Module._load;
Module._load = function(request, ...args) {
    return request === 'vscode' ? vscode : originalLoad.call(this, request, ...args);
};
const { compileHtml } = require('../out/vscode/compile');
Module._load = originalLoad;

async function main() {
    fs.writeFileSync(sourcePath, '# Saved on disk');
    fs.writeFileSync(videoPath, 'test video');
    await compileHtml();
    assert.strictEqual(notices.options.defaultUri.fsPath, outputPath);
    const html = fs.readFileSync(outputPath, 'utf8');
    assert.match(html, /<h1>Unsaved changes<\/h1>/);
    assert.match(html, /hash: true/);
    assert.match(html, /talk-assets\/demo\.mp4/);
    assert.strictEqual(fs.readFileSync(path.join(assetDir, 'demo.mp4'), 'utf8'), 'test video');
    assert.match(notices.info.pop(), /Generated presentation/);

    document.text = '{\nauthor: "Broken"';
    await compileHtml();
    assert.match(notices.errors.pop(), /Could not compile presentation/);
    assert.strictEqual(fs.readFileSync(outputPath, 'utf8'), html);

    document.text = '# Valid';
    fs.symlinkSync(sourcePath, aliasPath);
    selected = uri(aliasPath);
    await compileHtml();
    assert.match(notices.errors.pop(), /must not replace the source/);
    assert.strictEqual(fs.readFileSync(sourcePath, 'utf8'), '# Saved on disk');

    selected = undefined;
    await compileHtml();
    assert.strictEqual(notices.errors.length, 0);
    selected = uri(sourcePath);
    await compileHtml();
    assert.match(notices.errors.pop(), /Choose a local .html file/);
    selected = uri(path.join(dir, 'missing', 'out.html'));
    await compileHtml();
    assert.match(notices.errors.pop(), /Could not generate presentation/);

    document.uri = { scheme: 'untitled' };
    await compileHtml();
    assert.match(notices.errors.pop(), /Save the SlideDeck file/);
    document.uri = uri(sourcePath);
    vscode.workspace.isTrusted = false;
    await compileHtml();
    assert.match(notices.errors.pop(), /Trust this workspace/);
    console.log('VS Code compile tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});
