const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { SlideDeckLanguageMetaData } = require('../out/language/generated/module');
const { PollGenerator } = require('../out/generator/poll-generator');

const root = path.join(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slidedeck-rebrand-'));
const modern = path.join(dir, 'modern.slidedeck');
const legacy = path.join(dir, 'legacy.sdml');
const collision = path.join(dir, 'modern.sdml');
const outputs = [path.join(dir, 'modern.html'), path.join(dir, 'legacy.html')];
try {
    assert.deepStrictEqual(SlideDeckLanguageMetaData.fileExtensions, ['.slidedeck', '.sdml']);
    const pollScript = new PollGenerator().getPollJS();
    assert.doesNotThrow(() => new Function(pollScript));
    const pathExpression = pollScript.match(/pathname\.match\((\/.*?\/)\)/)[1];
    const expression = new Function(`return ${pathExpression}`)();
    assert.strictEqual('/home/user/SlideDeck/examples/demo.html'.match(expression)[1], '/examples/demo.html');
    assert.strictEqual('/home/user/sse-dsl-SlideDeckML/examples/demo.html'.match(expression)[1], '/examples/demo.html');
    fs.writeFileSync(modern, '# Modern');
    fs.writeFileSync(legacy, '# Legacy');
    const result = spawnSync('bash', ['build-and-compile.sh', dir, '', '--skip-build'], { cwd: root, encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(fs.readFileSync(outputs[0], 'utf8'), /<h1>Modern<\/h1>/);
    assert.match(fs.readFileSync(outputs[1], 'utf8'), /<h1>Legacy<\/h1>/);
    fs.writeFileSync(collision, '# Collision');
    const duplicate = spawnSync('bash', ['build-and-compile.sh', dir, '', '--skip-build'], { cwd: root, encoding: 'utf8' });
    assert.notStrictEqual(duplicate.status, 0);
    assert.match(duplicate.stdout, /Multiple presentation files/);
    assert.match(fs.readFileSync(outputs[0], 'utf8'), /<h1>Modern<\/h1>/);
    console.log('SlideDeck rebrand tests passed');
} finally {
    for (const file of [modern, legacy, collision, ...outputs]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(dir);
}
