const assert = require('assert');
const fs = require('fs');
const os = require('os');
const vscode = require('vscode');
const path = require('path');
const { ImagePasteProvider } = require('../out/vscode/image-paste');
const { CompilerService } = require('../out/services/compiler-service');

async function run() {
    const extension = vscode.extensions.getExtension('slidedeck.slidedeck');
    assert.ok(extension, 'Extension must be registered');
    await extension.activate();
    assert.ok((await vscode.commands.getCommands(true)).includes('slidedeck.compileHtml'),
        'Expected the HTML compilation command');
    assert.ok((await vscode.commands.getCommands(true)).includes('slidedeck.startPresentation'),
        'Expected the start presentation command');
    const document = await vscode.workspace.openTextDocument({
        language: 'slidedeck',
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
    const example = vscode.Uri.file(path.join(__dirname, '../examples/sdml/01-simple-markdown.slidedeck'));
    const tokens = await vscode.commands.executeCommand('_workbench.captureSyntaxTokens', example);
    assert.ok(Array.isArray(tokens) && tokens.length > 0, 'Expected TextMate syntax tokens');
    const syntax = JSON.stringify(tokens);
    assert.ok(syntax.includes('slidedeck'), 'Expected SlideDeck TextMate scopes');
    assert.ok(syntax.includes('punctuation.definition.heading.slidedeck'), 'Expected heading scope');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdml-grammar-'));
    const fixture = path.join(dir, 'highlight.slidedeck');
    const legacyFixture = path.join(dir, 'legacy.sdml');
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
        fs.writeFileSync(legacyFixture, '# Legacy');
        const newDocument = await vscode.workspace.openTextDocument(fixture);
        const legacyDocument = await vscode.workspace.openTextDocument(legacyFixture);
        assert.strictEqual(newDocument.languageId, 'slidedeck');
        assert.strictEqual(legacyDocument.languageId, 'slidedeck');
        const scopes = JSON.stringify(await vscode.commands.executeCommand('_workbench.captureSyntaxTokens', vscode.Uri.file(fixture)));
        for (const scope of ['variable.other.property', 'markup.bold', 'markup.italic',
            'entity.other.attribute-name.class', 'string.other.link', 'keyword.control.directive',
            'markup.raw.block']) {
            assert.ok(scopes.includes(scope), `Expected syntax scope ${scope}`);
        }
    } finally {
        fs.unlinkSync(fixture);
        fs.unlinkSync(legacyFixture);
        fs.rmdirSync(dir);
    }

    const pasteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdml-paste-'));
    const sourcePath = path.join(pasteDir, 'slides.slidedeck');
    let imagePath;
    try {
        fs.writeFileSync(sourcePath, '# Before\n\n# After');
        const source = await vscode.workspace.openTextDocument(sourcePath);
        const range = new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 0));
        const provider = new ImagePasteProvider(vscode.DocumentDropOrPasteEditKind.Empty.append('slidedeck', 'image'));
        const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
        const item = { asFile: () => ({ name: 'clipboard.png', data: async () => bytes }) };
        const transfer = new Map([['image/png', item]]);
        const edits = await provider.provideDocumentPasteEdits(
            source, [range], transfer, {}, { isCancellationRequested: false }
        );
        assert.strictEqual(edits.length, 1);
        const paste = edits[0];
        assert.match(paste.insertText, /^!\[Image\]\(\.\/img\/image-[a-f0-9]{32}\.png\)$/);
        imagePath = path.join(pasteDir, 'img', paste.insertText.match(/image-[a-f0-9]{32}\.png/)[0]);
        paste.additionalEdit.insert(source.uri, range.start, paste.insertText);
        assert.ok(await vscode.workspace.applyEdit(paste.additionalEdit), 'Expected paste workspace edit to succeed');
        assert.deepStrictEqual(fs.readFileSync(imagePath), Buffer.from(bytes));
        const result = await new CompilerService().compile(source.getText(), undefined, sourcePath);
        assert.ifError(result.error);
        assert.ok(result.html.includes('data:image/png;base64,'));
    } finally {
        if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        if (fs.existsSync(path.join(pasteDir, 'img'))) fs.rmdirSync(path.join(pasteDir, 'img'));
        fs.unlinkSync(sourcePath);
        fs.rmdirSync(pasteDir);
    }
    console.log(`SlideDeck extension host: ${completions.items.length} completion items`);
}

exports.run = run;
