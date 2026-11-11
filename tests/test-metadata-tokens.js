const fs = require('fs');
const {createSlideDeckServices} = require('./out/language/slide-deck-module');
const {NodeFileSystem} = require('langium/node');

const content = fs.readFileSync('./examples/with-metadata.sdml', 'utf-8');
console.log('Content:', content.substring(0, 100));

const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
const lexer = services.parser.Lexer;

const tokens = lexer.tokenize(content);
console.log('\nFirst 10 tokens:');
tokens.tokens.slice(0, 10).forEach(token => {
    console.log(`  ${token.tokenType.name}: "${token.image.substring(0, 50).replace(/\n/g, '\\n')}"`);
});
