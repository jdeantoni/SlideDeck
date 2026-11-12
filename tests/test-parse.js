const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSlideDeckServices } = require('../out/language/slide-deck-module');
const { NodeFileSystem } = require('langium/node');

const source = fs.readFileSync(path.join(__dirname, '../examples/sdml/01-simple-markdown.slidedeck'), 'utf8');
const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
const result = services.parser.LangiumParser.parse(source);
assert.deepStrictEqual(result.lexerErrors, []);
assert.deepStrictEqual(result.parserErrors, []);
assert.strictEqual(result.value.metadata.title, 'Simple Markdown Test');
assert.strictEqual(result.value.slides.slides.length, 6);
const lines = result.value.slides.slides[0].blocks[0].lines;
assert.deepStrictEqual(lines.map(line => [line.$type, line.level, line.text]), [
    ['Header', '#', 'Main Title (H1)'],
    ['Header', '##', 'Subtitle (H2)'],
    ['Header', '###', 'Sub-subtitle (H3)']
]);
console.log('Parser tests passed');
