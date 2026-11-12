const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { NodeFileSystem } = require('langium/node');
const { createSlideDeckServices } = require('../out/language/slide-deck-module');
const { CompilerService } = require('../out/services/compiler-service');
const { withBlockOffset } = require('../out/generator/block-position');
const { ImageConverter } = require('../out/generator/image-converter');

async function main() {
    const source = [
        "::: {color: 'red'}",
        ":::: {.columns}",
        "::: {width: '50%'}",
        '::: {animate: "fade-in"}',
        "::: {color: 'blue'}",
        '![QR] "https://example.com"',
        '```js',
        '::: end',
        '```',
        '::: end',
        '::: end',
        '::: end',
        '::: end',
        '::: end'
    ].join('\n');
    const compiler = new CompilerService();
    const result = await compiler.compile(source, undefined, undefined, { previewImagePositions: true });
    assert.ifError(result.error);
    assert.ok(result.html.includes('color: red'));
    assert.ok(result.html.includes('color: blue'));
    assert.ok(result.html.includes('display: flex'));
    assert.ok(result.html.includes('class="fragment fade-in"'));
    assert.ok(result.html.includes('api.qrserver.com'));
    assert.ok(result.html.includes('::: end'));
    assert.strictEqual(result.blockMappings.length, 4);
    for (const block of result.blockMappings) {
        assert.strictEqual(source.slice(block.start, block.end), block.content);
        assert.ok(block.content.endsWith('::: end'));
        const moved = withBlockOffset(block.content, block.style, { x: 10, y: 20 });
        assert.ok(moved.includes("translate: '10px 20px'"));
    }

    const columns = await compiler.compile('::::\n::: {color: red}\nOne\n::: end\n::: end');
    assert.ifError(columns.error);
    assert.match(columns.html, /color: red; width: 100%/);
    for (const invalid of ['::: {color: red}\nText', '::: {color: red}\nText\n:::', '::: end']) {
        const failed = await compiler.compile(invalid);
        assert.ok(failed.error, `Expected a syntax error for ${JSON.stringify(invalid)}`);
    }

    const parser = createSlideDeckServices(NodeFileSystem).SlideDeck.parser.LangiumParser;
    const exampleFiles = [];
    function checkExamples(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) checkExamples(file);
            else if (/\.(sdml|slidedeck)$/.test(entry.name)) {
                exampleFiles.push(file);
                const parsed = parser.parse(fs.readFileSync(file, 'utf8'));
                assert.deepStrictEqual(parsed.lexerErrors, [], `${file}: lexer errors`);
                assert.deepStrictEqual(parsed.parserErrors, [], `${file}: parser errors`);
            }
        }
    }
    checkExamples(path.resolve(__dirname, '../examples'));
    const convert = ImageConverter.convertToBase64Async;
    try {
        ImageConverter.convertToBase64Async = async () => 'data:image/png;base64,fixture';
        for (const file of exampleFiles) {
            const compiled = await compiler.compile(fs.readFileSync(file, 'utf8'), undefined, file);
            assert.ifError(compiled.error);
        }
    } finally {
        ImageConverter.convertToBase64Async = convert;
    }
    console.log('Explicit fence tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
