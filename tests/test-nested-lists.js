const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { CompilerService } = require('../out/services/compiler-service');

async function main() {
    const source = [
        '# Nested lists',
        '- Main **point**',
        '   - Sub one',
        '   - Sub [two]{font-size: \'20px\'}',
        '      1. Numbered child',
        '      2. Numbered sibling',
        '   - Sub three',
        '- Next main',
        '3. Ordered root',
        '   - Mixed child',
        '   - Another child',
        '4. Next ordered',
        '',
        '::: {.example}',
        '- Styled root',
        '  - Styled child',
        ':::',
        '',
        '::: {animate: "fade-in"}',
        '- Fragment root',
        '\t- Tab child',
        ':::'
    ].join('\n');

    const normalize = html => html.replace(/\s*\r?\n\s*/g, '').replace(/>\s+</g, '><');
    const expected = [
        '<ul><li>Main <strong>point</strong><ul><li>Sub one</li><li>Sub <span style="font-size: 20px">two</span><ol><li>Numbered child</li><li>Numbered sibling</li></ol></li><li>Sub three</li></ul></li><li>Next main</li></ul>',
        '<ol start="3"><li>Ordered root<ul><li>Mixed child</li><li>Another child</li></ul></li><li>Next ordered</li></ol>',
        '<div class="example"><ul><li>Styled root<ul><li>Styled child</li></ul></li></ul></div>',
        '<ul><li>Fragment root<ul><li>Tab child</li></ul></li></ul>'
    ];
    const compiler = new CompilerService();
    const check = result => {
        assert.ifError(result.error);
        const html = normalize(result.html);
        for (const fragment of expected) assert.ok(html.includes(fragment), fragment);
    };
    check(await compiler.compile(source));
    check(await compiler.compile(source.replace(/\n/g, '\r\n')));

    const flat = await compiler.compile('- First\n - Still flat\n- Last');
    assert.ifError(flat.error);
    assert.ok(normalize(flat.html).includes('<ul><li>First</li><li>Still flat</li><li>Last</li></ul>'));

    const multiDigit = await compiler.compile('10. Ten\n    - Child\n       + Grandchild\n    2. Numbered child\n11. Eleven');
    assert.ifError(multiDigit.error);
    assert.ok(normalize(multiDigit.html).includes(
        '<ol start="10"><li>Ten<ul><li>Child<ul><li>Grandchild</li></ul></li></ul><ol start="2"><li>Numbered child</li></ol></li><li>Eleven</li></ol>'
    ));

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-lists-'));
    const input = path.join(directory, 'slides.sdml');
    const output = path.join(directory, 'slides.html');
    try {
        fs.writeFileSync(input, source);
        execFileSync(process.execPath, [path.resolve(__dirname, '../out/cli/main.js'), 'compile', input, '-o', output]);
        const html = normalize(fs.readFileSync(output, 'utf8'));
        for (const fragment of expected) assert.ok(html.includes(fragment), fragment);
    } finally {
        if (fs.existsSync(output)) fs.unlinkSync(output);
        if (fs.existsSync(input)) fs.unlinkSync(input);
        fs.rmdirSync(directory);
    }

    console.log('Nested list tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
