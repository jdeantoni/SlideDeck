const fs = require('fs');
const path = require('path');
const {createSlideDeckServices} = require('./out/language/slide-deck-module');
const {NodeFileSystem} = require('langium/node');
const {URI} = require('vscode-uri');

async function test() {
    const content = fs.readFileSync('./examples/minimal.sdml', 'utf-8');
    
    const services = createSlideDeckServices(NodeFileSystem).SlideDeck;
    
    const document = services.shared.workspace.LangiumDocumentFactory.fromString(
        content,
        URI.file(path.resolve('./examples/minimal.sdml'))
    );
    
    await services.shared.workspace.DocumentBuilder.build([document], { validationChecks: 'all' });
    
    const presentation = document.parseResult.value;
    
    console.log(JSON.stringify(presentation, (key, value) => {
        if (key === '$container' || key === '$containerProperty' || key === '$containerIndex' || key === '$document' || key === '$cstNode') {
            return undefined;
        }
        return value;
    }, 2));
}

test().catch(console.error);
