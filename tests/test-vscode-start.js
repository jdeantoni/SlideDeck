const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const Module = require('module');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck start '));
const sourcePath = path.join(dir, 'talk slides.slidedeck');
const outputPath = path.join(dir, 'talk slides.html');
const captured = path.join(dir, 'browser-args.json');
const uri = file => ({ scheme: 'file', fsPath: file });
const document = {
    languageId: 'slidedeck',
    uri: uri(sourcePath),
    text: '# Unsaved',
    getText() { return this.text; }
};
const notices = { errors: [], prompts: [] };
let choice = 'Replace and Start';
let executable = process.execPath;
let args = ['-e', 'require("fs").writeFileSync(process.argv[1], JSON.stringify(process.argv.slice(2)))', captured];
const vscode = {
    Uri: { file: uri },
    env: { remoteName: undefined },
    workspace: {
        isTrusted: true,
        getConfiguration: () => ({ get: key => key === 'browserExecutable' ? executable : args })
    },
    window: {
        activeTextEditor: { document },
        showWarningMessage: async (...values) => { notices.prompts.push(values); return choice; },
        showErrorMessage: message => notices.errors.push(message)
    }
};
const originalLoad = Module._load;
Module._load = function(request, ...values) {
    return request === 'vscode' ? vscode : originalLoad.call(this, request, ...values);
};
const { startPresentation } = require('../out/vscode/start');
Module._load = originalLoad;

async function waitFor(predicate) {
    const deadline = Date.now() + 5000;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(predicate(), 'Timed out waiting for browser process');
}

async function main() {
    fs.writeFileSync(sourcePath, '# Saved');
    await startPresentation();
    await waitFor(() => fs.existsSync(captured));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(captured, 'utf8')), [pathToFileURL(outputPath).href]);
    assert.match(fs.readFileSync(outputPath, 'utf8'), /<h1>Unsaved<\/h1>/);
    assert.strictEqual(notices.prompts.length, 0);

    fs.unlinkSync(captured);
    choice = undefined;
    document.text = '# Changed';
    await startPresentation();
    assert.strictEqual(notices.prompts.length, 1);
    assert.strictEqual(notices.prompts[0][1].modal, true);
    assert.match(fs.readFileSync(outputPath, 'utf8'), /<h1>Unsaved<\/h1>/);
    assert.ok(!fs.existsSync(captured));

    choice = 'Replace and Start';
    document.text = '{\nauthor: "Broken"';
    await startPresentation();
    assert.match(notices.errors.pop(), /Could not compile presentation/);
    assert.match(fs.readFileSync(outputPath, 'utf8'), /<h1>Unsaved<\/h1>/);
    assert.ok(!fs.existsSync(captured));

    document.text = '# Changed';
    await startPresentation();
    await waitFor(() => fs.existsSync(captured));
    assert.match(fs.readFileSync(outputPath, 'utf8'), /<h1>Changed<\/h1>/);

    executable = path.join(dir, 'missing-browser');
    await startPresentation();
    await waitFor(() => notices.errors.length > 0);
    assert.match(notices.errors.pop(), /Could not start browser/);
    executable = process.execPath;
    args = ['-e', 'process.exit(3)'];
    await startPresentation();
    await waitFor(() => notices.errors.length > 0);
    assert.match(notices.errors.pop(), /exited with code 3/);
    fs.unlinkSync(outputPath);
    fs.symlinkSync(sourcePath, outputPath);
    await startPresentation();
    assert.match(notices.errors.pop(), /must not replace the source file/);
    assert.strictEqual(fs.readFileSync(sourcePath, 'utf8'), '# Saved');
    fs.unlinkSync(outputPath);
    executable = '';
    await startPresentation();
    assert.match(notices.errors.pop(), /Configure a browser executable/);
    vscode.env.remoteName = 'ssh-remote';
    await startPresentation();
    assert.match(notices.errors.pop(), /not supported in remote workspaces/);
    assert.ok(!fs.existsSync(outputPath));
    console.log('VS Code start presentation tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    for (const file of [sourcePath, outputPath, captured]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(dir);
});
