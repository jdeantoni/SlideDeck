const assert = require('assert');
const path = require('path');
const { CompilerService } = require('../out/services/compiler-service');
const { getImageOffset, withImageOffset, getImageSize, withImageSize } = require('../out/generator/image-position');

async function main() {
    const image = path.join(__dirname, '../examples/templates/template2/assets/image_logo.png');
    const original = `![Logo](${image})`;
    const moved = withImageOffset(original, { x: 30.5, y: -7 });
    const resized = withImageSize(moved, 400, 200);
    assert.deepStrictEqual(getImageSize(resized), { width: 400, height: 200 });
    assert.deepStrictEqual(getImageOffset(resized), { x: 30.5, y: -7 });
    assert.strictEqual(withImageOffset(resized, { x: 4, y: 5 }), `${original}{offset: '4px 5px'}{size: '400px 200px'}`);
    assert.deepStrictEqual(getImageOffset(moved), { x: 30.5, y: -7 });
    assert.strictEqual(withImageOffset(moved, { x: -12, y: 0 }), `${original}{offset: '-12px 0px'}`);

    const source = `# Test\n${original}\n::: {width: '50%'}\n${moved}\n::: end\n::: {animate: "fade-in"}\n${original}\n::: end`;
    const compiler = new CompilerService();
    const preview = await compiler.compile(source, undefined, undefined, { previewImagePositions: true });
    assert.ifError(preview.error);
    assert.strictEqual(preview.imageMappings.length, 3);
    for (const mapping of preview.imageMappings) {
        assert.strictEqual(source.slice(mapping.start, mapping.end), mapping.content);
    }
    assert.ok(preview.html.includes('style="translate: 30.5px -7px"'));
    assert.strictEqual((preview.html.match(/data-sd-image="/g) || []).length, 3);
    assert.strictEqual(new Set(preview.imageMappings.map(mapping => mapping.start)).size, 3);

    const standalone = await compiler.compile(source);
    assert.ifError(standalone.error);
    assert.ok(standalone.html.includes('style="translate: 30.5px -7px"'));
    assert.ok(!standalone.html.includes('data-sd-image='));
    assert.deepStrictEqual(standalone.imageMappings, []);
    const sized = await compiler.compile(resized);
    assert.ifError(sized.error);
    assert.ok(sized.html.includes('width: 400px; height: 200px; max-width: none; max-height: none; translate: 30.5px -7px'));

    const sync = await compiler.compile('```js\nhello\n```\n:::[sync-fragments]\n' + moved + '\n:::[sync-fragments]');
    assert.ifError(sync.error);
    assert.ok(sync.html.includes('translate: 30.5px -7px'));
    console.log('Image position tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
