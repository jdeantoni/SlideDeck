const fs = require('fs');
const path = require('path');
const {createSlideDeckServices} = require('./out/language/slide-deck-module');
const {NodeFileSystem} = require('langium/node');
const {URI} = require('vscode-uri');

async function test() {
    const content = fs.readFileSync('./examples/with-metadata.sdml', 'utf-8');
    
    const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
    
    const document = services.shared.workspace.LangiumDocumentFactory.fromString(
        content,
        URI.file(path.resolve('./examples/with-metadata.sdml'))
    );
    
    await services.shared.workspace.DocumentBuilder.build([document], { validationChecks: 'all' });
    
    const presentation = document.parseResult.value;
    
    console.log('Metadata:', presentation.metadata);
    if (presentation.metadata) {
        console.log('Block:', presentation.metadata.block);
    }
}

test().catch(console.error);
