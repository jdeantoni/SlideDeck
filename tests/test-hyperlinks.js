const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { TextProcessor } = require('../out/generator/element-generator');
const { CompilerService } = require('../out/services/compiler-service');
const { createSlideDeckServices } = require('../out/language/slide-deck-module');
const { NodeFileSystem } = require('langium/node');

async function main() {
    const format = text => new TextProcessor().processInlineText(text);
    assert.strictEqual(format('Go to ![**site**] "https://example.com/a_b?x=1&y=2".'),
        'Go to <a href="https://example.com/a_b?x=1&amp;y=2"><strong>site</strong></a>.');
    assert.strictEqual(format('[![site] "https://example.com"]{.highlight}'),
        '<span class="highlight"><a href="https://example.com">site</a></span>');
    assert.strictEqual(format('![mail] "mailto:hello@example.com" ![local] "../slides.html" ![jump] "#/2"'),
        '<a href="mailto:hello@example.com">mail</a> <a href="../slides.html">local</a> <a href="#/2">jump</a>');
    assert.strictEqual(format('![<unsafe>] "https://example.com/?a=<b>"'),
        '<a href="https://example.com/?a=&lt;b&gt;">&lt;unsafe&gt;</a>');
    assert.throws(() => format('![bad] "javascript:alert(1)"'), /Invalid hyperlink destination/);
    assert.throws(() => format('![bad] "java\tscript:alert(1)"'), /Invalid hyperlink destination/);
    assert.throws(() => format('![bad] "data:text/html,test"'), /Invalid hyperlink destination/);
    assert.throws(() => format('![bad] ""'), /Invalid hyperlink destination/);

    const source = [
        '# ![Heading] "https://example.com"',
        '![Standalone] "https://example.com"',
        'See ![one] "https://example.com/a" and ![two] "https://example.com/b".',
        '- ![List] "https://example.com"',
        '  - ![Nested] "mailto:a@example.com"',
        '> ![Quote] "#/1"',
        '::: {animate: "fade-in"}',
        '![Fragment] "https://example.com"',
        ':::',
        ':::[sync-fragments]',
        '![Sync] "https://example.com"',
        ':::[sync-fragments]',
        '![QR] "https://example.com"',
        '```js',
        '![code] "https://example.com"',
        '```'
    ].join('\n');
    const expected = [
        '<h1><a href="https://example.com">Heading</a></h1>',
        '<p><a href="https://example.com">Standalone</a></p>',
        'See <a href="https://example.com/a">one</a> and <a href="https://example.com/b">two</a>.',
        '<li><a href="https://example.com">List</a>',
        '<li><a href="mailto:a@example.com">Nested</a></li>',
        '<blockquote><a href="#/1">Quote</a></blockquote>',
        '<a href="https://example.com">Fragment</a>',
        '<a href="https://example.com">Sync</a>',
        'data=https%3A%2F%2Fexample.com" alt="QR Code"',
        '![code] &quot;https://example.com&quot;'
    ];
    const check = html => {
        for (const fragment of expected) assert.ok(html.includes(fragment), fragment);
        assert.ok(!html.includes('<a href="https://example.com">QR</a>'));
    };
    const compiler = new CompilerService();
    const result = await compiler.compile(source);
    assert.ifError(result.error);
    check(result.html);
    const invalid = await compiler.compile('![bad] "javascript:alert(1)"');
    assert.match(invalid.error, /Invalid hyperlink destination/);
    const qrExample = fs.readFileSync(path.resolve(__dirname, '../examples/sdml/20-qrcode.slidedeck'), 'utf8');
    const qrResult = await compiler.compile(qrExample);
    assert.ifError(qrResult.error);
    assert.strictEqual((qrResult.html.match(/class="qr-code-standalone"/g) || []).length, 3);

    const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
    const media = services.parser.LangiumParser.parse('![Picture](https://example.com/image.png)');
    assert.strictEqual(media.parserErrors.length, 0);
    assert.strictEqual(media.lexerErrors.length, 0);
    assert.strictEqual(media.value.slides.slides[0].blocks[0].lines[0].$type, 'Media');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-links-'));
    const input = path.join(dir, 'slides.sdml');
    const output = path.join(dir, 'slides.html');
    try {
        fs.writeFileSync(input, source);
        execFileSync(process.execPath, [path.resolve(__dirname, '../out/cli/main.js'), 'compile', input, '-o', output]);
        check(fs.readFileSync(output, 'utf8'));
    } finally {
        if (fs.existsSync(output)) fs.unlinkSync(output);
        if (fs.existsSync(input)) fs.unlinkSync(input);
        fs.rmdirSync(dir);
    }

    console.log('Hyperlink tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
