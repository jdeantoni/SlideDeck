const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { CompilerService } = require('../out/services/compiler-service');

async function main() {
    const source = `{
    author: "Test"
    title: "Slide numbers"
    css: ".reveal .slide-number { font-size: 20px; color: red; }"
}
===
# First slide
===
# Second slide
`;
    const check = html => {
        assert.match(html, /slideNumber:\s*'c\/t'/);
        assert.ok(html.includes('.reveal .slide-number { font-size: 20px; color: red; }'));
    };

    const result = await new CompilerService().compile(source);
    assert.ifError(result.error);
    assert.strictEqual(result.slideCount, 2);
    check(result.html);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-numbers-'));
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

    console.log('Slide number tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
