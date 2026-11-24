const assert = require('assert');
const { CompilerService } = require('../out/services/compiler-service');

async function main() {
    const compiler = new CompilerService();
    const normalize = html => html.replace(/\s*\r?\n\s*/g, '').replace(/>\s+</g, '><');
    const compile = async source => {
        const result = await compiler.compile(source);
        assert.ifError(result.error);
        return normalize(result.html);
    };

    const source = [
        '# Table',
        '| Name | Amount | Note |',
        '| :--- | ---: | :---: |',
        '| **Alice** | 42 | A \\| B |',
        '| Bob |',
        '| Carol | 3 | <unsafe> | ignored |',
        '',
        'After the table',
        '===',
        '# Next slide'
    ].join('\n');
    const expected = '<table><thead><tr><th style="text-align: left">Name</th><th style="text-align: right">Amount</th><th style="text-align: center">Note</th></tr></thead><tbody>' +
        '<tr><td style="text-align: left"><strong>Alice</strong></td><td style="text-align: right">42</td><td style="text-align: center">A | B</td></tr>' +
        '<tr><td style="text-align: left">Bob</td><td style="text-align: right"></td><td style="text-align: center"></td></tr>' +
        '<tr><td style="text-align: left">Carol</td><td style="text-align: right">3</td><td style="text-align: center">&lt;unsafe&gt;</td></tr></tbody></table>';
    for (const input of [source, source.replace(/\n/g, '\r\n')]) {
        const html = await compile(input);
        assert.ok(html.includes(expected));
        assert.ok(html.includes('<p>After the table</p>'));
        assert.ok(html.includes('<h1>Next slide</h1>'));
    }

    const noOuterPipes = await compile('Name | Value\n--- | ---\nA | 1\nsingle cell\n\nDone');
    assert.ok(noOuterPipes.includes('<tr><td>single cell</td><td></td></tr>'));
    assert.ok(noOuterPipes.includes('<p>Done</p>'));
    assert.ok((await compile('| One |\n| --- |')).includes('<thead><tr><th>One</th></tr></thead>'));
    assert.ok((await compile('| A | B |\n| --- |')).includes('<p>| A | B |</p><p>| --- |</p>'));
    assert.ok((await compile('A | B\nordinary text')).includes('<p>A | B</p><p>ordinary text</p>'));
    assert.ok(!(await compile('A \\| B\n---')).includes('<table>'));

    const nested = await compile([
        '::: {.example}', '| A | B |', '| - | - |', '| x | y |', '::: end',
        '::: {animate: "fade-in"}', '| C | D |', '| - | - |', '| z | w |', '::: end',
        ':::: {.columns}', '| E | F |', '| - | - |', '| g | h |', '::: end'
    ].join('\n'));
    assert.strictEqual((nested.match(/<table>/g) || []).length, 3);
    assert.ok(nested.includes('<div class="example"><table>'));
    assert.ok(nested.includes('class="fragment fade-in"'));
    assert.ok(nested.includes('<td>g</td><td>h</td>'));

    const adjacent = await compile('| A | B |\n| - | - |\n| x | y |\n- List item\n# Heading\n```\n| not | a table |\n| --- | --- |\n```');
    assert.ok(adjacent.includes('<ul><li>List item</li></ul><h1>Heading</h1>'));
    assert.strictEqual((adjacent.match(/<table>/g) || []).length, 1);
    const footnotes = await compile("| [Head]{footnote: 'first'} |\n| --- |\n| [Body]{footnote: 'second'} |");
    assert.ok(footnotes.includes('Head</span><sup class="footnote-marker">[1]</sup>'));
    assert.ok(footnotes.includes('Body</span><sup class="footnote-marker">[2]</sup>'));
    console.log('Table tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
