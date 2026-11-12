const assert = require('assert');
const { createSlideDeckServices } = require('../out/language/slide-deck-module');
const { NodeFileSystem } = require('langium/node');

const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
const result = services.parser.Lexer.tokenize('# Test\n- Item 1\n1. Numbered');
assert.deepStrictEqual(result.errors, []);
assert.deepStrictEqual(result.tokens.map(token => [token.tokenType.name, token.image]), [
    ['HEADER_LEVEL', '#'], ['PARAGRAPH_TEXT', 'Test'],
    ['LIST_MARKER', '-'], ['PARAGRAPH_TEXT', 'Item 1'],
    ['INT', '1'], ['.', '.'], ['PARAGRAPH_TEXT', 'Numbered']
]);
console.log('Lexer tests passed');
