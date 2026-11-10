const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { TextProcessor } = require('../out/generator/element-generator');
const { CompilerService } = require('../out/services/compiler-service');

async function main() {
    const processor = new TextProcessor();
    const format = text => processor.processInlineText(text);

    assert.strictEqual(
        format('- **Event**: [EDT Catalyst – PC1]{.small-note} *in-person kickoff*'),
        '- <strong>Event</strong>: <span class="small-note">EDT Catalyst – PC1</span> <em>in-person kickoff</em>'
    );
    assert.strictEqual(
        format('[**important** and *urgent*]{.highlight .large; font-size: \'20px\'; color: \'red\'}'),
        '<span class="highlight large" style="font-size: 20px; color: red"><strong>important</strong> and <em>urgent</em></span>'
    );
    assert.strictEqual(
        format('**before [inside]{.some_class} after** [one]{color: rgba(1, 2, 3, 0.5)}[two]{--size: 20px}'),
        '<strong>before <span class="some_class">inside</span> after</strong> <span style="color: rgba(1, 2, 3, 0.5)">one</span><span style="--size: 20px">two</span>'
    );
    assert.strictEqual(
        format('[outer [inner]{.inner}]{.outer}'),
        '<span class="outer">outer <span class="inner">inner</span></span>'
    );
    assert.strictEqual(format('\\[literal]{.note} [bracket \\] text]{.note}'),
        '[literal]{.note} <span class="note">bracket ] text</span>');
    assert.strictEqual(format('[ordinary](url) [bad]{not-css} [unfinished]{color: red'),
        '[ordinary](url) [bad]{not-css} [unfinished]{color: red');
    assert.strictEqual(
        format('[<unsafe>]{content: \'" onmouseover="evil\'; color: red}'),
        '<span style="content: &quot; onmouseover=&quot;evil; color: red">&lt;unsafe&gt;</span>'
    );
    assert.strictEqual(
        format('[x]{background: \'url(images/foo.bar.png)\'; font-family: \'"A; B"\'}'),
        '<span style="background: url(images/foo.bar.png); font-family: &quot;A; B&quot;">x</span>'
    );
    assert.strictEqual(format('Normal **bold** and _italic_ & <text>'),
        'Normal <strong>bold</strong> and <em>italic</em> &amp; &lt;text&gt;');

    const input = [
        '# [Heading]{.title}',
        '',
        '[Paragraph]{font-size: \'20px\'} with [**bold**]{.note}',
        '',
        '- [List]{.highlight}',
        '',
        '1. [Number]{color: red}',
        '',
        '> [Quote]{.note}',
        '',
        '::: {.block; color: \'blue\'}',
        '[Block content]{.inner}',
        ':::',
        '',
        ':::[sync-fragments]',
        '[Synchronized]{.note}',
        ':::[sync-fragments]'
    ].join('\n');
    const expected = [
        '<h1><span class="title">Heading</span></h1>',
        '<span style="font-size: 20px">Paragraph</span>',
        '<span class="note"><strong>bold</strong></span>',
        '<li><span class="highlight">List</span></li>',
        '<li><span style="color: red">Number</span></li>',
        '<blockquote><span class="note">Quote</span></blockquote>',
        '<div class="block" style="color: blue">',
        '<span class="inner">Block content</span>',
        '<span class="note">Synchronized</span>'
    ];

    const result = await new CompilerService().compile(input);
    assert.ifError(result.error);
    for (const fragment of expected) assert.ok(result.html.includes(fragment), fragment);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeckml-inline-'));
    const source = path.join(tempDir, 'slides.sdml');
    const output = path.join(tempDir, 'slides.html');
    try {
        fs.writeFileSync(source, input);
        execFileSync(process.execPath, [path.resolve(__dirname, '../out/cli/main.js'), 'compile', source, '-o', output]);
        const html = fs.readFileSync(output, 'utf8');
        for (const fragment of expected) assert.ok(html.includes(fragment), fragment);
    } finally {
        if (fs.existsSync(output)) fs.unlinkSync(output);
        if (fs.existsSync(source)) fs.unlinkSync(source);
        fs.rmdirSync(tempDir);
    }

    console.log('Inline style tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
