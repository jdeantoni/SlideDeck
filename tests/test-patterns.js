const assert = require('assert');

const headerPattern = /(###|##|#)[ \t]+[^\r\n]+/;
const unorderedPattern = /[\-\*\+][ \t]+[^\r\n]+/;
const orderedPattern = /[0-9]+\.[ \t]+[^\r\n]+/;
const textPattern = /[^\r\n]+/;

const testLines = [
    "# Test",
    "- Item 1",
    "1. Numbered"
];

assert.deepStrictEqual(testLines.map(line => [
    headerPattern.test(line), unorderedPattern.test(line),
    orderedPattern.test(line), textPattern.test(line)
]), [
    [true, false, false, true],
    [false, true, false, true],
    [false, false, true, true]
]);
console.log('Pattern tests passed');
