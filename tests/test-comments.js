const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { CompilerService } = require('../out/services/compiler-service');

async function main() {
    const source = [
        '// hidden before metadata',
        '{',
        '  author: "Test" // hidden after author',
        '  /* hidden inside metadata */',
        '  title: "Comments"',
        '  css: ".example { background: url(https://example.com/image.png); }"',
        '}',
        '===',
        '# Comment test',
        '  // hidden indented comment',
        '/* hidden first line',
        'hidden second line */',
        'Visible URL https://example.com/a and // text remains',
        'Visible /* inline markers remain */ text',
        '- Parent',
        '  // hidden within list',
        '  - Child',
        '::: {.example}',
        '/* hidden inside style */',
        'Styled text',
        ':::',
        '```js',
        '// comment inside code',
        '/* block comment inside code */',
        '```',
        '===',
        '# Second slide',
        '// hidden at end of file'
    ].join('\n');

    const check = html => {
        for (const comment of ['hidden before metadata', 'hidden after author', 'hidden inside metadata',
            'hidden indented comment', 'hidden first line', 'hidden second line', 'hidden within list',
            'hidden inside style', 'hidden at end of file']) {
            assert.ok(!html.includes(comment), `SDML comment should not be rendered: ${comment}`);
        }
        assert.ok(html.includes('https://example.com/a and // text remains'));
        assert.ok(html.includes('inline markers remain'));
        assert.ok(html.includes('url(https://example.com/image.png)'));
        assert.ok(html.includes('// comment inside code'));
        assert.ok(html.includes('/* block comment inside code */'));
        assert.match(html, /<li>Parent\s*<ul>\s*<li>Child<\/li>/);
        assert.ok(html.includes('Styled text'));
    };

    const compiler = new CompilerService();
    for (const text of [source, source.replace(/\n/g, '\r\n')]) {
        const result = await compiler.compile(text);
        assert.ifError(result.error);
        assert.strictEqual(result.slideCount, 2);
        check(result.html);
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-comments-'));
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
    console.log('Comment tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
