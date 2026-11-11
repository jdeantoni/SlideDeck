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

    const styled = new TextProcessor();
    assert.strictEqual(styled.processInlineText('[*a concept*]{footnote: [\'a styled footnote\']{.todo}};'),
        '<span><em>a concept</em></span><sup class="footnote-marker">[1]</sup>;');
    assert.ok(styled.renderFootnotes().includes('<li><span class="todo">a styled footnote</span></li>'));
    styled.resetFootnotes();
    styled.processInlineText('[x]{footnote: ["A & <B>"]{.todo .small; color: \'red\'; font-size: \'12px\'}; color: blue}');
    assert.ok(styled.renderFootnotes().includes(
        '<li><span class="todo small" style="color: red; font-size: 12px">A &amp; &lt;B&gt;</span></li>'));
    styled.resetFootnotes();
    styled.processInlineText('[x]{footnote: [\'It\\\'s "safe"\']{content: \'" onmouseover="evil\'}}');
    assert.ok(styled.renderFootnotes().includes(
        '<li><span style="content: &quot; onmouseover=&quot;evil">It&#39;s &quot;safe&quot;</span></li>'));
    styled.resetFootnotes();
    styled.processInlineText('[x]{footnote: [\'Nested\']{footnote: \'no\'}}');
    assert.strictEqual(styled.renderFootnotes(), '');
    styled.resetFootnotes();
    styled.processInlineText('[x]{footnote: [\'text\'; note: \'one\']{.todo; note: \'two\'}}');
    assert.strictEqual(styled.renderFootnotes(), '');
    styled.resetFootnotes();
    styled.processInlineText('[x]{footnote: [\'text\'; note: \'" & <hover>; \\\'quoted\\\'\']{.todo; color: red}; note: \'reference\'}');
    assert.ok(styled.renderFootnotes().includes(
        '<li><span class="todo" style="color: red" title="&quot; &amp; &lt;hover&gt;; &#39;quoted&#39;" data-sd-note>text</span></li>'));
    styled.resetFootnotes();
    styled.processInlineText('[x]{footnote: [\'text\']{note: \'hover\'}}');
    assert.ok(styled.renderFootnotes().includes('<li><span title="hover" data-sd-note>text</span></li>'));

    const userText = 'we have no actual reasearch activity dedicated to the way to express the characteristics in a VF. In our  experiments, we may use existing technologies like extending the Asset Administration Shell with a specific metamodel; or similar';
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
        '[styled]{footnote: [\'Styled & <safe>\']{.todo; color: red}; note: \'hover\'}',
        `[*validity frame*]{footnote: ['${userText}'; note: '${userText}']{.todo}}`,
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
            ['1', '2', '3', '4', '5', '6', '7']);
        assert.ok(first.includes('<span style="color: red" title="Hover" data-sd-note>first</span><sup class="footnote-marker">[2]</sup>'));
        assert.ok(first.includes('<li>First &amp; &lt;safe&gt;</li>'));
        assert.ok(first.includes('<li>It&#39;s a list</li>'));
        assert.ok(first.includes('<li>Fragment</li>'));
        assert.ok(first.includes('<li><span class="todo" style="color: red">Styled &amp; &lt;safe&gt;</span></li>'));
        assert.ok(first.includes('<span><em>validity frame</em></span><sup class="footnote-marker">[7]</sup>'));
        assert.ok(first.includes(`<li><span class="todo" title="${userText}" data-sd-note>${userText}</span></li>`));
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

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-footnotes-'));
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
