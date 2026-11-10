const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { CompilerService } = require('../out/services/compiler-service');
const { TextProcessor } = require('../out/generator/element-generator');
const { ImageConverter } = require('../out/generator/image-converter');

async function main() {
    const text = new TextProcessor();
    assert.strictEqual(text.processInlineText('[x]{footnote: no-quotes}'), '[x]{footnote: no-quotes}');
    assert.strictEqual(text.processInlineText('[x]{footnote: \'\'}'), '[x]{footnote: &#39;&#39;}');
    assert.strictEqual(text.processInlineText('[x]{footnote: \'a\'; footnote: \'b\'}'),
        '[x]{footnote: &#39;a&#39;; footnote: &#39;b&#39;}');

    const source = [
        '# [Title]{footnote: \'Title note\'}',
        '[first]{note: \'Hover\'; footnote: \'First & <safe>\'; color: red}',
        '- [list]{footnote: "It\'s a list"}',
        '::: {.box}',
        '[inside]{footnote: \'Inside\'}',
        ':::',
        '::: {animate: "fade-in"}',
        '[fragment]{footnote: \'Fragment\'}',
        ':::',
        '===',
        '[second slide]{footnote: \'Second slide note\'}',
        '===',
        '# No footnotes'
    ].join('\n');

    const check = html => {
        const sections = [...html.matchAll(/<section data-slide-index="(\d+)"[^>]*>([\s\S]*?)<\/section>/g)];
        assert.deepStrictEqual(sections.map(section => section[1]), ['0', '1', '2']);
        const first = sections[0][2];
        const second = sections[1][2];
        assert.deepStrictEqual([...first.matchAll(/class="footnote-marker">\[(\d+)\]/g)].map(m => m[1]),
            ['1', '2', '3', '4', '5']);
        assert.ok(first.includes('<span style="color: red" title="Hover">first</span><sup class="footnote-marker">[2]</sup>'));
        assert.ok(first.includes('<li>First &amp; &lt;safe&gt;</li>'));
        assert.ok(first.includes('<li>It&#39;s a list</li>'));
        assert.ok(first.includes('<li>Fragment</li>'));
        assert.ok(second.includes('<sup class="footnote-marker">[1]</sup>'));
        assert.ok(second.includes('<li>Second slide note</li>'));
        assert.ok(!sections[2][2].includes('slide-footnotes'));
    };

    const compiler = new CompilerService();
    const result = await compiler.compile(source);
    assert.ifError(result.error);
    check(result.html);

    const original = ImageConverter.convertToBase64Async;
    ImageConverter.convertToBase64Async = async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'data:image/png;base64,AA==';
    };
    try {
        const [a, b] = await Promise.all([
            compiler.compile('![Image](fake.png)\n[one]{footnote: \'Only A\'}\n===\n[two]{footnote: \'Next A\'}'),
            compiler.compile('[three]{footnote: \'Only B\'}')
        ]);
        assert.ifError(a.error);
        assert.ifError(b.error);
        assert.ok(a.html.includes('Only A') && a.html.includes('Next A') && !a.html.includes('Only B'));
        assert.ok(b.html.includes('Only B') && !b.html.includes('Only A'));
        assert.strictEqual((a.html.match(/class="footnote-marker">\[1\]/g) || []).length, 2);
    } finally {
        ImageConverter.convertToBase64Async = original;
    }

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeckml-footnotes-'));
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
    console.log('Footnote tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
