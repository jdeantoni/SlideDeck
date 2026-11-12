const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const tests = fs.readdirSync(__dirname).filter(name => /^test-.*\.js$/.test(name)).sort();
let failed = 0;
for (const test of tests) {
    console.log(`\n--- ${test} ---`);
    const result = spawnSync(process.execPath, [path.join(__dirname, test)], { stdio: 'inherit' });
    if (result.error) {
        console.error(`Could not run ${test}:`, result.error);
        failed++;
    } else if (result.status !== 0) {
        console.error(`${test} failed${result.signal ? ` (${result.signal})` : ` (exit ${result.status})`}`);
        failed++;
    }
}
console.log(`\n${tests.length - failed}/${tests.length} test scripts passed.`);
if (failed || tests.length === 0) process.exitCode = 1;
