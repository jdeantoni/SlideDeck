const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CompilerService } = require('../out/services/compiler-service');
const { getBlockOffset, withBlockOffset, withAnnotationScale } = require('../out/generator/block-position');
const { annotationSvg, validateAnnotations } = require('../out/vscode/annotation');

async function main() {
    const strokes = [
        { tool: 'pen', color: '#ff0033', width: 4, points: [{ x: 10, y: 20 }, { x: 40, y: 50 }, { x: 70, y: 10 }] },
        { tool: 'ellipse', color: '#0055ff', width: 2, points: [{ x: 20, y: 10 }, { x: 90, y: 70 }] },
        { tool: 'rectangle', color: '#0055ff', width: 2, points: [{ x: 20, y: 10 }, { x: 90, y: 70 }] },
        { tool: 'arrow', color: '#0055ff', width: 2, points: [{ x: 20, y: 10 }, { x: 90, y: 70 }] }
    ];
    assert.ok(validateAnnotations(strokes));
    assert.ok(!validateAnnotations([{ ...strokes[0], color: 'red" onload="bad' }]));
    assert.ok(!validateAnnotations([{ ...strokes[0], points: [{ x: Infinity, y: 0 }, { x: 0, y: 1 }] }]));
    for (const stroke of strokes) {
        const svg = annotationSvg(stroke, 960, 700);
        assert.match(svg, /^<svg .*viewBox="0 0 960 700"/);
        assert.ok(svg.includes('stroke-linecap="round"'));
        assert.ok(svg.includes(`stroke="${stroke.color}"`));
    }

    const source = "::: {.box; color: 'red'}\n# Title\nText\n:::";
    const moved = withBlockOffset(source, "{.box; color: 'red'}", { x: 25, y: -8.5 });
    assert.ok(moved.startsWith("::: {.box; color: 'red'; translate: '25px -8.5px'}"));
    assert.deepStrictEqual(getBlockOffset("{.box; color: 'red'; translate: '25px -8.5px'}"), { x: 25, y: -8.5 });
    assert.strictEqual(getBlockOffset("{translate: '50% 1px'}"), undefined);
    const movedAgain = withBlockOffset(moved, "{.box; color: 'red'; translate: '25px -8.5px'}", { x: 2, y: 3 });
    assert.strictEqual((movedAgain.match(/translate:/g) || []).length, 1);
    assert.ok(withBlockOffset(':::\nText\n:::', undefined, { x: 2, y: 3 }).startsWith("::: {translate: '2px 3px'}"));
    const annotation = '::: {.sd-annotation-layer}\n![Annotation](./annotation.svg)\n:::';
    const scaled = withAnnotationScale(annotation, '{.sd-annotation-layer}', { x: 1.5, y: 2, originX: 98, originY: 118 });
    assert.ok(scaled.includes("--sd-annotation-scale-x: '1.5'; --sd-annotation-scale-y: '2'; transform-origin: '98px 118px'"));
    const movedAnnotation = withBlockOffset(scaled, "{.sd-annotation-layer; --sd-annotation-scale-x: '1.5'; --sd-annotation-scale-y: '2'; transform-origin: '98px 118px'}", { x: 10, y: -3 });
    assert.ok(movedAnnotation.includes("translate: '10px -3px'"));
    const commaStyle = "{.sd-annotation-layer, color: 'red', --sd-annotation-scale-x: '1', --sd-annotation-scale-y: '1', transform-origin: '0px 0px', translate: '10px -3px'}";
    const resizedAgain = withAnnotationScale(`::: ${commaStyle}\nText\n:::`, commaStyle, { x: 2, y: 3, originX: 98, originY: 118 });
    assert.ok(resizedAgain.includes("color: 'red'"));
    assert.ok(resizedAgain.includes("translate: '10px -3px'"));
    assert.strictEqual((resizedAgain.match(/--sd-annotation-scale-x:/g) || []).length, 1);
    assert.ok(resizedAgain.includes("--sd-annotation-scale-x: '2'; --sd-annotation-scale-y: '3'; transform-origin: '98px 118px'"));
    assert.throws(() => withAnnotationScale(source, "{.box; color: 'red'}", { x: 2, y: 2, originX: 0, originY: 0 }));

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-annotation-'));
    try {
        fs.writeFileSync(path.join(dir, 'annotation.svg'), annotationSvg(strokes[0], 960, 700));
        const fragment = `::: {animate: "fade-in"}\n${movedAnnotation}\n:::`;
        const document = `${moved}\n${fragment}\n${fragment}\n===\n# Next slide`;
        const compiler = new CompilerService();
        const preview = await compiler.compile(document, undefined, path.join(dir, 'slides.slidedeck'), { previewImagePositions: true });
        assert.ifError(preview.error);
        assert.strictEqual(preview.blockMappings.length, 3);
        const block = preview.blockMappings[0];
        assert.strictEqual(document.slice(block.start, block.end), moved);
        assert.ok(preview.html.includes('data-sd-block="0"'));
        assert.ok(preview.html.includes('translate: 25px -8.5px'));
        assert.ok(preview.html.includes('class="fragment fade-in"'));
        assert.ok(preview.html.includes('class="sd-annotation-layer"'));
        assert.ok(preview.html.includes('data:image/svg+xml;base64,'));
        assert.ok(preview.html.includes('--sd-annotation-scale-x: 1.5; --sd-annotation-scale-y: 2; transform-origin: 98px 118px; translate: 10px -3px'));
        assert.strictEqual(document.slice(preview.slideEndOffsets[0], preview.slideEndOffsets[0] + 1), '\n');
        const standalone = await compiler.compile(document, undefined, path.join(dir, 'slides.slidedeck'));
        assert.ifError(standalone.error);
        assert.ok(!standalone.html.includes('data-sd-block='));
        if (process.env.SLIDEDECK_ANNOTATION_TEST_HTML) fs.writeFileSync(process.env.SLIDEDECK_ANNOTATION_TEST_HTML, standalone.html);
    } finally {
        fs.unlinkSync(path.join(dir, 'annotation.svg'));
        fs.rmdirSync(dir);
    }
    console.log('Annotation and block tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
