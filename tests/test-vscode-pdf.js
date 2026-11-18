const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const childProcess = require('child_process');
const { fileURLToPath } = require('url');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-pdf-'));
const sourcePath = path.join(directory, 'talk.slidedeck');
const videoPath = path.join(directory, 'demo.mp4');
const outputPath = path.join(directory, 'talk.pdf');
const uri = file => ({ scheme: 'file', fsPath: file });
const document = {
    languageId: 'slidedeck',
    uri: uri(sourcePath),
    getText: () => `{
  author: "Test"
  title: "Test deck"
}
===
# Title
===
## Fragments
- First
::: {animate: "fade-in"}
Second
::: end
===
![Video](./demo.mp4)`
};
const notices = { errors: [], info: [] };
let selected = uri(outputPath);
let exitCode = 0;
let spawnArguments;
const vscode = {
    Uri: { file: uri },
    workspace: {
        isTrusted: true,
        getConfiguration: () => ({ get: (key, fallback) => key === 'decktapeExecutable' ? 'decktape' : fallback })
    },
    window: {
        activeTextEditor: { document },
        showSaveDialog: async options => {
            assert.strictEqual(options.filters.PDF[0], 'pdf');
            return selected;
        },
        showErrorMessage: message => notices.errors.push(message),
        showInformationMessage: message => notices.info.push(message)
    }
};

const originalLoad = Module._load;
const originalSpawn = childProcess.spawn;
childProcess.spawn = (executable, args, options) => {
    assert.strictEqual(executable, 'decktape');
    assert.deepStrictEqual(args.slice(0, 2), ['reveal', '--fragments']);
    assert.strictEqual(options.shell, false);
    assert.strictEqual(options.cwd, directory);
    spawnArguments = args;
    const htmlPath = fileURLToPath(args[2]);
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.match(html, /<h1>Title<\/h1>/);
    assert.match(html, /class="fragment fade-in"/);
    const assetsPath = path.join(directory, `${path.basename(htmlPath, '.html')}-assets`);
    assert.strictEqual(fs.readFileSync(path.join(assetsPath, 'demo.mp4'), 'utf8'), 'video');

    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stderr.setEncoding = () => {};
    if (exitCode === 0) fs.writeFileSync(args[3], 'PDF');
    process.nextTick(() => {
        if (exitCode !== 0) child.stderr.emit('data', 'DeckTape test failure');
        child.emit('close', exitCode, null);
    });
    return child;
};
Module._load = function(request, ...args) {
    return request === 'vscode' ? vscode : originalLoad.call(this, request, ...args);
};
const { exportPdf } = require('../out/vscode/export-pdf');
Module._load = originalLoad;

async function main() {
    fs.writeFileSync(sourcePath, '# Saved on disk');
    fs.writeFileSync(videoPath, 'video');
    await exportPdf();
    assert.deepStrictEqual(notices.errors, []);
    assert.strictEqual(fs.readFileSync(outputPath, 'utf8'), 'PDF');
    assert.strictEqual(notices.info.length, 1);
    assert.strictEqual(notices.errors.length, 0);
    assert.ok(spawnArguments[2].startsWith('file://'));
    assert.deepStrictEqual(
        fs.readdirSync(directory).filter(name => name.startsWith('.slidedeck-export-')),
        []
    );

    selected = uri(path.join(directory, 'failed.pdf'));
    exitCode = 1;
    await exportPdf();
    assert.match(notices.errors.pop(), /DeckTape failed with exit code 1: DeckTape test failure/);
    assert.ok(!fs.existsSync(selected.fsPath));
    assert.deepStrictEqual(
        fs.readdirSync(directory).filter(name => name.startsWith('.slidedeck-export-')),
        []
    );
    console.log('VS Code PDF export tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    childProcess.spawn = originalSpawn;
    fs.rmSync(directory, { recursive: true, force: true });
});
