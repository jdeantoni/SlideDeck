const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { CompilerService } = require('../out/services/compiler-service');
const { ImageConverter } = require('../out/generator/image-converter');

async function main() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-header-'));
    const template = path.join(dir, 'header.sdml');
    const deckPath = path.join(dir, 'talk.slidedeck');
    const output = path.join(dir, 'talk.html');
    try {
        fs.writeFileSync(template, '{\nauthor: "Template author"\ntitle: "Default title"\ntheme: "white"\ncss: ".reveal h1 { color: teal; }"\ntransition: "fade"\n}');
        const source = '@import "header.sdml"\n{\n  title: "My title"\n}\n===\n# First\n===\n::: {color: red}\nSecond\n:::';
        fs.writeFileSync(deckPath, source);
        const compiler = new CompilerService();
        let result = await compiler.compile(source, 7, deckPath, { previewImagePositions: true });
        assert.ifError(result.error);
        assert.strictEqual(result.slideCount, 2);
        assert.strictEqual(result.slideIndex, 1);
        assert.strictEqual(result.slideStartLines[0], 5);
        assert.ok(result.html.includes('<title>My title</title>'));
        assert.ok(result.html.includes('content="Template author"'));
        assert.ok(result.html.includes('.reveal h1 { color: teal; }'));
        assert.ok(result.html.includes('transition: "fade"'));
        assert.strictEqual(source.slice(result.blockMappings[0].start, result.blockMappings[0].end), result.blockMappings[0].content);
        execFileSync(process.execPath, [path.resolve(__dirname, '../out/cli/main.js'), 'compile', deckPath, '-o', output]);
        assert.ok(fs.readFileSync(output, 'utf8').includes('<title>My title</title>'));
        fs.writeFileSync(template, '{\nauthor: "Changed"\ntitle: "Default title"\n}');
        result = await compiler.compile(source, undefined, deckPath);
        assert.ifError(result.error);
        assert.ok(result.html.includes('content="Changed"'));
        result = await compiler.compile('@import "header.sdml"\n===\n# Slide', undefined, deckPath);
        assert.ifError(result.error);
        assert.ok(result.html.includes('<title>Default title</title>'));
        result = await compiler.compile(source);
        assert.match(result.error, /Save the presentation/);
        result = await compiler.compile('@import "missing.sdml"\n===\n# Slide', undefined, deckPath);
        assert.match(result.error, /Cannot read template "missing\.sdml"/);
        fs.writeFileSync(template, '{\nauthor: "Missing title"\n}');
        result = await compiler.compile(source, undefined, deckPath);
        assert.match(result.error, /Invalid template/);
        fs.writeFileSync(template, '{\nauthor: "A"\ntitle: "T"\n}\n===\n# Extra slide');
        result = await compiler.compile(source, undefined, deckPath);
        assert.match(result.error, /only a metadata header/);
        const failed = spawnSync(process.execPath, [path.resolve(__dirname, '../out/cli/main.js'), 'compile', deckPath, '-o', output], { encoding: 'utf8' });
        assert.notStrictEqual(failed.status, 0);
        assert.match(failed.stderr, /only a metadata header/);
        result = await compiler.compile('@import "/absolute.sdml"\n===\n# Slide', undefined, deckPath);
        assert.match(result.error, /relative to the presentation/);
        const sample = path.resolve(__dirname, '../examples/sdml/22-template-import.slidedeck');
        result = await compiler.compile(fs.readFileSync(sample, 'utf8'), undefined, sample);
        assert.ifError(result.error);
        assert.ok(result.html.includes('<title>A presentation using a shared header</title>'));
        const convertImage = ImageConverter.convertToBase64Async;
        try {
            ImageConverter.convertToBase64Async = async () => 'data:image/png;base64,fixture';
            for (const [number, name] of [['08', 'academic'], ['09', 'business'], ['10', 'technical'], ['11', 'minimal'], ['12', 'conference']]) {
                const file = path.resolve(__dirname, `../examples/sdml/${number}-template-${name}.slidedeck`);
                const deck = fs.readFileSync(file, 'utf8');
                const header = fs.readFileSync(path.resolve(__dirname, `../examples/templates/${name}/${name}-header.slidedeck`), 'utf8');
                const overrides = deck.match(/^\@import "[^"]+"\n\{\n    author: "([^"]+)"\n    title: "([^"]+)"\n\}\n/);
                assert.ok(overrides, `${name}: missing import or overrides`);
                const inline = header.replace('author: "Your Name"', `author: "${overrides[1]}"`)
                    .replace('title: "Your Presentation"', `title: "${overrides[2]}"`).trimEnd() + '\n' + deck.slice(overrides[0].length);
                const imported = await compiler.compile(deck, undefined, file);
                const original = await compiler.compile(inline, undefined, file);
                assert.ifError(imported.error);
                assert.ifError(original.error);
                assert.ok(imported.slideCount > 0, name);
                assert.strictEqual(imported.slideCount, original.slideCount, name);
                assert.strictEqual(imported.html, original.html, `${name}: imported presentation changed`);
            }
        } finally {
            ImageConverter.convertToBase64Async = convertImage;
        }
        console.log('Template import tests passed');
    } finally {
        for (const file of [output, deckPath, template]) if (fs.existsSync(file)) fs.unlinkSync(file);
        fs.rmdirSync(dir);
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
