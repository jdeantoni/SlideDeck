const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CompilerService } = require('../out/services/compiler-service');
const { IdeRuntimeGenerator } = require('../out/generator/ide-runtime');

async function main() {
    const example = fs.readFileSync(path.join(__dirname, '../examples/sdml/19-integrated-ide.slidedeck'), 'utf8');
    const compiler = new CompilerService();
    const result = await compiler.compile(example);
    assert.ifError(result.error);
    assert.strictEqual((result.html.match(/monaco-editor@0\.45\.0\/min\/vs\/loader\.js/g) || []).length, 1);
    assert.ok(result.html.includes("require(['vs/editor/editor.main']"));
    assert.ok(result.html.includes('data-initial-code="def fibonacci(n):'));
    assert.ok(!result.html.includes('RevealSeminar, RevealPoll'));
    assert.deepStrictEqual([...result.html.matchAll(/<div id="(editor-\d+)"/g)].map(match => match[1]),
        ['editor-0', 'editor-1', 'editor-2', 'editor-3']);

    const plain = await compiler.compile('# No editors');
    assert.ifError(plain.error);
    assert.ok(!plain.html.includes('monaco-editor@0.45.0'));
    const directSource = ',,,ide javascript\n```\nconsole.log("hello");\n```\noutput: "result",,,\noutput: "result"';
    const direct = await compiler.compile(directSource);
    assert.ifError(direct.error);
    assert.ok(direct.html.includes('class="monaco-editor-wrapper"'));
    assert.ok(direct.html.includes('id="result"'));
    assert.ok(direct.html.includes("require(['vs/editor/editor.main']"));

    const quiz = fs.readFileSync(path.join(__dirname, '../examples/sdml/21-quiz.slidedeck'), 'utf8');
    const quizOnly = await compiler.compile(quiz);
    assert.ifError(quizOnly.error);
    assert.ok(quizOnly.html.includes('RevealSeminar, RevealPoll'));
    assert.ok(!quizOnly.html.includes('monaco-editor@0.45.0'));
    const combined = await compiler.compile(quiz + '\n===\n' + directSource);
    assert.ifError(combined.error);
    assert.ok(combined.html.includes('RevealSeminar, RevealPoll'));
    assert.strictEqual((combined.html.match(/monaco-editor@0\.45\.0\/min\/vs\/loader\.js/g) || []).length, 1);
    assert.ok(combined.html.includes("require(['vs/editor/editor.main']"));

    const runtime = new IdeRuntimeGenerator();
    runtime.enable();
    const script = runtime.generateMonacoEditorScript();
    const initial = 'console.log("&lt;");';
    const attrs = { 'data-language': 'javascript', 'data-initial-code': initial, 'data-output-id': 'result' };
    const editorElement = { id: 'editor-0', getAttribute: name => attrs[name] };
    const output = { textContent: '', style: {} };
    const button = {
        getAttribute: () => 'editor-0',
        addEventListener(type, handler) { this.handler = handler; }
    };
    const document = {
        querySelectorAll: selector => selector === '.monaco-editor-wrapper' ? [editorElement] : [button],
        getElementById: id => id === 'editor-0' ? editorElement : output
    };
    const logs = [];
    const consoleMock = { log: (...args) => logs.push(args), error: (...args) => logs.push(args) };
    let value;
    const amd = (_dependencies, callback) => callback();
    amd.config = () => {};
    const context = {
        window: {}, document, console: consoleMock, require: amd,
        monaco: { editor: { create: (_element, options) => {
            value = options.value;
            return { getValue: () => value };
        } } }
    };
    vm.runInNewContext(script, context);
    assert.strictEqual(value, initial);
    value = 'console.log("updated")';
    await button.handler();
    assert.strictEqual(output.textContent, 'updated');
    const originalLog = consoleMock.log;
    value = 'throw new Error("failed")';
    await button.handler();
    assert.strictEqual(output.textContent, 'Error: failed');
    assert.strictEqual(consoleMock.log, originalLog);

    const failedElement = {};
    const failedButton = {};
    const failedDocument = {
        querySelectorAll: selector => selector === '.monaco-editor-wrapper' ? [failedElement] : [failedButton]
    };
    vm.runInNewContext(script, { window: {}, document: failedDocument, console: consoleMock });
    assert.match(failedElement.textContent, /Could not load the code editor/);
    assert.strictEqual(failedButton.disabled, true);
    failedElement.textContent = '';
    failedButton.disabled = false;
    const failingAmd = (_dependencies, _callback, onError) => onError(new Error('network failure'));
    failingAmd.config = () => {};
    vm.runInNewContext(script, { window: {}, document: failedDocument, console: consoleMock, require: failingAmd });
    assert.match(failedElement.textContent, /Could not load the code editor/);
    assert.strictEqual(failedButton.disabled, true);
    console.log('Embedded IDE tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
