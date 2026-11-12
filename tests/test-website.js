const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CompilerService } = require('../out/services/compiler-service');

async function main() {
    const directory = path.resolve(__dirname, '../website');
    for (const name of ['index.html', 'guide.html', 'features.html']) {
        const html = fs.readFileSync(path.join(directory, name), 'utf8');
        assert.match(html, /<html lang="en">/);
        assert.match(html, /name="viewport"/);
        for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
            if (/^(?:https?:|mailto:)/.test(href)) continue;
            const [file, fragment] = href.split('#');
            const target = file ? path.join(directory, file) : path.join(directory, name);
            assert.ok(fs.existsSync(target), `${name}: missing ${href}`);
            if (fragment) {
                assert.ok(fs.readFileSync(target, 'utf8').includes(`id="${fragment}"`), `${name}: missing ${href}`);
            }
        }
    }

    const guide = fs.readFileSync(path.join(directory, 'guide.html'), 'utf8');
    const example = guide.match(/<pre><code>(\{\n  author:[\s\S]*?)<\/code><\/pre>/);
    assert.ok(example, 'Missing presentation example');
    const result = await new CompilerService().compile(example[1]);
    assert.ifError(result.error);
    assert.ok(result.html.includes('<h1>Hello, SlideDeck</h1>'));
    assert.ok(result.html.includes('<strong>bold</strong>'));
    const features = fs.readFileSync(path.join(directory, 'features.html'), 'utf8');
    const expected = {
        basics: '<strong>bold</strong>',
        lists: '<li>Gather ideas</li>',
        links: 'class="qr-code-standalone"',
        notes: '<span style="color: blue">A styled explanation</span>',
        styles: 'width: 50%; margin: 0 auto',
        classes: '<span class="callout">word</span>',
        columns: '<div class="columns"',
        grid: 'grid-template-columns: 1fr 1fr; gap: 20px',
        position: 'position: absolute; left: 100px; top: 200px; z-index: 2',
        image: 'width: 250px; height: 100px; max-width: none; max-height: none; translate: 20px 10px',
        video: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'local-video': './talk-assets/Exemple_preview.mp4',
        code: 'data-line-numbers="1|2"',
        sync: 'class="sync-item" data-sync-index="0"',
        math: 'class="latex-block"',
        animation: 'class="fragment fade-in"',
        editor: 'data-output-id="result"',
        quiz: '<h2>Quick quiz</h2>',
        chalkboard: 'RevealChalkboard',
        theme: '.reveal h1 { color: teal; }'
    };
    const examples = [...features.matchAll(/<pre data-example="([^"]+)"><code>([\s\S]*?)<\/code><\/pre>/g)];
    assert.deepStrictEqual(examples.map(match => match[1]).sort(), Object.keys(expected).sort());
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-website-'));
    try {
        for (const [, name, html] of examples) {
            const source = html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            const output = name === 'local-video' ? path.join(temporaryDirectory, 'talk.html') : undefined;
            const compiled = await new CompilerService().compile(source, undefined, path.resolve(__dirname, '../talk.slidedeck'), undefined, output);
            assert.ifError(compiled.error);
            assert.ok(compiled.html.includes(expected[name]), `Example ${name} did not generate ${expected[name]}`);
            if (name === 'local-video') {
                assert.ok(fs.existsSync(path.join(temporaryDirectory, 'talk-assets', 'Exemple_preview.mp4')));
            }
        }
    } finally {
        const copiedVideo = path.join(temporaryDirectory, 'talk-assets', 'Exemple_preview.mp4');
        if (fs.existsSync(copiedVideo)) fs.unlinkSync(copiedVideo);
        const assetsDirectory = path.dirname(copiedVideo);
        if (fs.existsSync(assetsDirectory)) fs.rmdirSync(assetsDirectory);
        fs.rmdirSync(temporaryDirectory);
    }
    console.log('Website tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
