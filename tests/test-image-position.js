const assert = require('assert');
const path = require('path');
const { CompilerService } = require('../out/services/compiler-service');
const { getImageOffset, withImageOffset } = require('../out/generator/image-position');

async function main() {
    const image = path.join(__dirname, '../examples/templates/template2/assets/image_logo.png');
    const original = `![Logo](${image})`;
    const moved = withImageOffset(original, { x: 30.5, y: -7 });
    assert.deepStrictEqual(getImageOffset(moved), { x: 30.5, y: -7 });
    assert.strictEqual(withImageOffset(moved, { x: -12, y: 0 }), `${original}{offset: '-12px 0px'}`);

    const source = `# Test\n${original}\n::: {width: '50%'}\n${moved}\n:::\n::: {animate: "fade-in"}\n${original}\n:::`;
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

    const sync = await compiler.compile('```js\nhello\n```\n:::[sync-fragments]\n' + moved + '\n:::[sync-fragments]');
    assert.ifError(sync.error);
    assert.ok(sync.html.includes('translate: 30.5px -7px'));
    console.log('Image position tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
