const fs = require('fs');
const {createSlideDeckServices} = require('./out/language/slide-deck-module');
const {NodeFileSystem} = require('langium/node');

const content = '{author:"John Doe" title:"My Awesome Presentation"}';

const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
const lexer = services.parser.Lexer;

const tokens = lexer.tokenize(content);
console.log('Tokens:');
tokens.tokens.forEach(token => {
    console.log(`  ${token.tokenType.name}: "${token.image}"`);
});

if (tokens.errors.length > 0) {
    console.log('\nLexer errors:');
    tokens.errors.forEach(error => {
        console.log(`  ${error.message}`);
    });
}
