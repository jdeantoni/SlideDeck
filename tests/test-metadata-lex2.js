const assert = require('assert');
const { createSlideDeckServices } = require('../out/language/slide-deck-module');
const { NodeFileSystem } = require('langium/node');

const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
const source = '{\nauthor: "John Doe"\ntitle: "My Awesome Presentation"\n}';
const result = services.parser.Lexer.tokenize(source);
assert.deepStrictEqual(result.errors, []);
assert.deepStrictEqual(result.tokens.map(token => [token.tokenType.name, token.image]), [
    ['{', '{'], ['author', 'author'], [':', ':'], ['STRING', '"John Doe"'],
    ['title', 'title'], [':', ':'], ['STRING', '"My Awesome Presentation"'], ['}', '}']
]);
const parsed = services.parser.LangiumParser.parse(source);
assert.deepStrictEqual(parsed.parserErrors, []);
assert.strictEqual(parsed.value.metadata.author, 'John Doe');
assert.strictEqual(parsed.value.metadata.title, 'My Awesome Presentation');
console.log('Metadata lexer tests passed');
