#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import open from 'open';
import type { Presentation } from '../language/generated/ast';
import { HtmlGenerator } from '../generator/html-generator';
import {createSlideDeckServices} from "../language/slide-deck-module";
import {NodeFileSystem} from "langium/node";
import {URI} from "vscode-uri";
import { DevServer } from '../dev-server/server';
import { InteractiveElementDetector } from '../generator/interactive-element-detector';

const program = new Command();

program
    .name('slidedeck')
    .description('Compile SlideDeck files to reveal.js HTML presentations')
    .version('1.0.13');

program
    .command('compile')
    .description('Compile a SlideDeck file to HTML')
    .argument('<input>', 'Input .slidedeck or .sdml file')
    .option('-o, --output <file>', 'Output HTML file', 'presentation.html')
    .action(async (input: string, options: { output: string }) => {
        try {
            await compile(input, options.output);
        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

program
    .command('dev')
    .description('Start development server with live preview')
    .argument('[input]', 'Optional input .slidedeck or .sdml file to load')
    .option('-p, --port <number>', 'Port number', '3000')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (input: string | undefined, options: { port: string, open: boolean }) => {
        try {
            const port = parseInt(options.port, 10);
            if (isNaN(port)) {
                throw new Error('Port must be a valid number');
            }

            // Resolve input file path if provided
            let inputFile: string | undefined;
            if (input) {
                inputFile = path.resolve(input);
            }

            const server = new DevServer({ port, initialFile: inputFile });
            await server.start();

            // Open browser if requested
            if (options.open) {
                try {
                    await open(`http://localhost:${port}`);
                } catch (error) {
                    console.log('Could not open browser automatically. Please open http://localhost:' + port + ' manually.');
                }
            }

            // Handle graceful shutdown
            process.on('SIGINT', () => {
                console.log('\nShutting down server...');
                server.stop();
                process.exit(0);
            });

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

async function compile(inputFile: string, outputFile: string): Promise<void> {
    console.log(`Compiling ${inputFile}...`);

    // Check if input file exists
    if (!fs.existsSync(inputFile)) {
        throw new Error(`Input file not found: ${inputFile}`);
    }

    // Read input file
    const content = fs.readFileSync(inputFile, 'utf-8');

    // Create Langium services
    const services = createSlideDeckServices(NodeFileSystem).SlideDeck;

    // Parse the document
    const document = services.shared.workspace.LangiumDocumentFactory.fromString(
        content,
        URI.file(path.resolve(inputFile))
    );

    // Build the document (validate and link)
    await services.shared.workspace.DocumentBuilder.build([document], { validationChecks: 'all' });

    // Check for parse errors
    if (document.parseResult.lexerErrors.length > 0) {
        console.error('Lexer errors:');
        document.parseResult.lexerErrors.forEach(error => {
            console.error(`  Line ${error.line}: ${error.message}`);
        });
        throw new Error('Failed to parse document');
    }

    if (document.parseResult.parserErrors.length > 0) {
        console.error('Parser errors:');
        document.parseResult.parserErrors.forEach(error => {
            console.error(`  Line ${error.token.startLine}: ${error.message}`);
        });
        throw new Error('Failed to parse document');
    }

    // Extract AST
    const presentation = document.parseResult.value as Presentation;

    // Check for interactive elements and inform user
    if (InteractiveElementDetector.hasInteractiveElements(presentation)) {
        console.log('Quiz/Poll detected - remember to start the server with: npm run quiz-server and to expose your port for participants to join.');
    }

    // Generate HTML
    const htmlGenerator = new HtmlGenerator();
    const html = await htmlGenerator.generateHTML(presentation, path.resolve(inputFile), path.resolve(outputFile));

    // Write output file
    fs.writeFileSync(outputFile, html, 'utf-8');

    console.log(`✓ Generated: ${outputFile}`);
    console.log(`  Open it in your browser to view the presentation!`);
}

program.parse();
