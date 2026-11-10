const assert = require('assert');
const fs = require('fs');
const os = require('os');
const vscode = require('vscode');
const path = require('path');

async function run() {
    const extension = vscode.extensions.getExtension('slidedeckml.slidedeckml');
    assert.ok(extension, 'Extension must be registered');
    await extension.activate();
    const document = await vscode.workspace.openTextDocument({
        language: 'slidedeckml',
        content: '# Example\nsdml-'
    });
    await vscode.window.showTextDocument(document);
    const completions = await vscode.commands.executeCommand(
        'vscode.executeCompletionItemProvider', document.uri, new vscode.Position(1, 5)
    );
    assert.ok(completions && completions.items.length, 'Expected completion items');
    const labels = completions.items.map(item => typeof item.label === 'string' ? item.label : item.label.label);
    for (const prefix of ['sdml-slide', 'sdml-fragment', 'sdml-link', 'sdml-footnote']) {
        assert.ok(labels.some(label => label.includes(prefix)), `Missing completion ${prefix}: ${labels.join(', ')}`);
    }
    const example = vscode.Uri.file(path.join(__dirname, '../examples/sdml/01-simple-markdown.sdml'));
    const tokens = await vscode.commands.executeCommand('_workbench.captureSyntaxTokens', example);
    assert.ok(Array.isArray(tokens) && tokens.length > 0, 'Expected TextMate syntax tokens');
    const syntax = JSON.stringify(tokens);
    assert.ok(syntax.includes('slidedeckml'), 'Expected SlideDeckML TextMate scopes');
    assert.ok(syntax.includes('punctuation.definition.heading.slidedeckml'), 'Expected heading scope');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdml-grammar-'));
    const fixture = path.join(dir, 'highlight.sdml');
    try {
        fs.writeFileSync(fixture, [
            '{',
            '  author: "Jane"',
            '  title: "Test"',
            '}',
            '===',
            '# Title',
            '- **bold** and *italic*',
            '[Text]{.large; color: \'red\'}',
            '![QR] "https://example.com"',
            '::: {animate: "fade-in"}',
            'Text',
            ':::',
            '```js',
            '// code comment',
            '```'
        ].join('\n'));
        const scopes = JSON.stringify(await vscode.commands.executeCommand('_workbench.captureSyntaxTokens', vscode.Uri.file(fixture)));
        for (const scope of ['variable.other.property', 'markup.bold', 'markup.italic',
            'entity.other.attribute-name.class', 'string.other.link', 'keyword.control.directive',
            'markup.raw.block']) {
            assert.ok(scopes.includes(scope), `Expected syntax scope ${scope}`);
        }
    } finally {
        fs.unlinkSync(fixture);
        fs.rmdirSync(dir);
    }
    console.log(`SlideDeckML extension host: ${completions.items.length} completion items`);
}

exports.run = run;
