#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import open from 'open';
import { DevServer } from '../dev-server/server';
import { CompilerService } from '../services/compiler-service';

const program = new Command();

program
    .name('slidedeck')
    .description('Compile SlideDeck files to reveal.js HTML presentations')
    .version('1.0.16');

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

    const result = await new CompilerService().compile(content, undefined, path.resolve(inputFile), undefined, path.resolve(outputFile));
    if (result.error) throw new Error(result.error);
    if (result.hasInteractiveElements) {
        console.log('Quiz/Poll detected - remember to start the server with: npm run quiz-server and to expose your port for participants to join.');
    }

    // Write output file
    fs.writeFileSync(outputFile, result.html, 'utf-8');

    console.log(`✓ Generated: ${outputFile}`);
    console.log(`  Open it in your browser to view the presentation!`);
}

program.parse();
