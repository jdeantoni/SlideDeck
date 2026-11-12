const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSlideDeckServices } = require('../out/language/slide-deck-module');
const { NodeFileSystem } = require('langium/node');

const source = fs.readFileSync(path.join(__dirname, '../examples/sdml/01-simple-markdown.slidedeck'), 'utf8');
const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
const result = services.parser.Lexer.tokenize(source);
assert.deepStrictEqual(result.errors, []);
assert.deepStrictEqual(result.tokens.slice(0, 10).map(token => [token.tokenType.name, token.image]), [
    ['{', '{'], ['author', 'author'], [':', ':'], ['STRING', '"SlideDeckML Team"'],
    ['title', 'title'], [':', ':'], ['STRING', '"Simple Markdown Test"'], ['}', '}'],
    ['SLIDE_SEPARATOR', '===\n'], ['HEADER_LEVEL', '#']
]);
console.log('Metadata example token tests passed');
