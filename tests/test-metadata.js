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
assert.strictEqual(result.value.metadata.author, 'SlideDeckML Team');
assert.strictEqual(result.value.metadata.title, 'Simple Markdown Test');
assert.ok(result.value.slides.slides.length > 0);

const missingTitle = services.parser.LangiumParser.parse('{\nauthor: "A"\n}\n===\n# Slide');
assert.ok(missingTitle.parserErrors.length > 0, 'Metadata without a title must be rejected');
console.log('Metadata parser tests passed');
