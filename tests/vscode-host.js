const assert = require('assert');
const fs = require('fs');
const os = require('os');
const vscode = require('vscode');
const path = require('path');
const { ImagePasteProvider } = require('../out/vscode/image-paste');
const { CompilerService } = require('../out/services/compiler-service');
const { withImageOffset } = require('../out/generator/image-position');
const { annotationSvg } = require('../out/vscode/annotation');

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
            '[Term]{footnote: [\'Styled\']{.todo; color: red}; note: \'Tip\'}',
            '![QR] "https://example.com"',
            '::: {animate: "fade-in"}',
            'Text',
            '::: end',
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
    const imageSource = '![Logo](image.png)';
    const layoutDocument = await vscode.workspace.openTextDocument({ language: 'slidedeck', content: imageSource });
    await vscode.window.showTextDocument(layoutDocument);
    const layoutEdit = new vscode.WorkspaceEdit();
    layoutEdit.replace(layoutDocument.uri, new vscode.Range(layoutDocument.positionAt(0), layoutDocument.positionAt(imageSource.length)),
        withImageOffset(imageSource, { x: 25, y: -10 }));
    assert.ok(await vscode.workspace.applyEdit(layoutEdit), 'Expected layout edit to succeed');
    assert.strictEqual(layoutDocument.getText(), `${imageSource}{offset: '25px -10px'}`);
    await vscode.commands.executeCommand('undo');
    assert.strictEqual(layoutDocument.getText(), imageSource, 'Layout edit should be undone in one step');
    const annotationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-drawing-'));
    const annotationSource = path.join(annotationDir, 'slides.slidedeck');
    const svgPath = path.join(annotationDir, 'img', 'annotation.svg');
    try {
        fs.writeFileSync(annotationSource, '# Drawing');
        const doc = await vscode.workspace.openTextDocument(annotationSource);
        await vscode.window.showTextDocument(doc);
        const edit = new vscode.WorkspaceEdit();
        const svg = annotationSvg({ tool: 'pen', color: '#ff0000', width: 4, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }, 960, 700);
        edit.createFile(vscode.Uri.file(svgPath), { contents: Buffer.from(svg), overwrite: false });
        edit.insert(doc.uri, doc.positionAt(doc.getText().length),
            '\n\n::: {animate: "fade-in"}\n::: {.sd-annotation-layer}\n![Annotation](./img/annotation.svg)\n::: end\n::: end');
        assert.ok(await vscode.workspace.applyEdit(edit));
        assert.ok(fs.existsSync(svgPath));
        const compiled = await new CompilerService().compile(doc.getText(), undefined, annotationSource);
        assert.ifError(compiled.error);
        assert.ok(compiled.html.includes('data:image/svg+xml;base64,'));
        await vscode.commands.executeCommand('undo');
        assert.strictEqual(doc.getText(), '# Drawing');
        assert.ok(fs.existsSync(svgPath), 'Undoing source insertion does not remove the saved SVG');
    } finally {
        if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);
        if (fs.existsSync(path.join(annotationDir, 'img'))) fs.rmdirSync(path.join(annotationDir, 'img'));
        fs.unlinkSync(annotationSource);
        fs.rmdirSync(annotationDir);
    }
    console.log(`SlideDeck extension host: ${completions.items.length} completion items`);
}

exports.run = run;
