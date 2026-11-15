const assert = require('assert');
const path = require('path');
const { CompilerService } = require('../out/services/compiler-service');

async function main() {
    const compiler = new CompilerService();
    const sourcePath = path.resolve(__dirname, '../examples/sdml/test.slidedeck');
    const source = '@import "../templates/academic/academic-header.slidedeck"\n' +
        '{\n  chalkboard: "true"\n}\n===\n# Test';
    const enabled = await compiler.compile(source, undefined, sourcePath);
    assert.ifError(enabled.error);
    assert.match(enabled.html, /\.reveal\s*{\s*margin-top:\s*50px/);
    assert.match(enabled.html, /\.reveal > #notescanvas,\s*\.reveal > #chalkboard\s*\{\s*position: fixed;\s*top: 0;\s*left: 0;\s*width: 100vw;\s*height: 100vh;/);
    assert.match(enabled.html, /RevealChalkboard/);

    const disabled = await compiler.compile('# No chalkboard');
    assert.ifError(disabled.error);
    assert.ok(!disabled.html.includes('.reveal > #notescanvas'));
    console.log('Chalkboard alignment tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
