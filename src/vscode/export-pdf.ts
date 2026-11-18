import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import * as vscode from 'vscode';
import { generateHtml, getPresentationDocument } from './compile';

export async function exportPdf(): Promise<void> {
    const document = getPresentationDocument();
    if (!document) return;

    let temporaryHtml: string | undefined;
    let temporaryAssets: string | undefined;
    let temporaryPdf: string | undefined;
    try {
        const sourcePath = document.uri.fsPath;
        const destination = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(
                path.dirname(sourcePath),
                path.basename(sourcePath, path.extname(sourcePath)) + '.pdf'
            )),
            filters: { 'PDF': ['pdf'] },
            saveLabel: 'Export PDF'
        });
        if (!destination) return;
        if (destination.scheme !== 'file' || path.extname(destination.fsPath).toLowerCase() !== '.pdf') {
            throw new Error('Choose a local .pdf file for the exported presentation.');
        }

        const sourceStat = await fs.promises.stat(sourcePath);
        try {
            const destinationStat = await fs.promises.stat(destination.fsPath);
            if (sourceStat.dev === destinationStat.dev && sourceStat.ino === destinationStat.ino) {
                throw new Error('The PDF must not replace the source file.');
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }

        const executable = vscode.workspace.getConfiguration('slidedeck')
            .get<string>('decktapeExecutable', 'decktape').trim();
        if (!executable) {
            throw new Error('Configure the DeckTape executable in SlideDeck settings.');
        }

        const token = crypto.randomBytes(12).toString('hex');
        const sourceDirectory = path.dirname(sourcePath);
        const temporaryHtmlName = `.slidedeck-export-${token}.html`;
        temporaryHtml = path.join(sourceDirectory, temporaryHtmlName);
        temporaryAssets = path.join(sourceDirectory, `${path.basename(temporaryHtmlName, '.html')}-assets`);
        temporaryPdf = path.join(
            path.dirname(destination.fsPath),
            `.${path.basename(destination.fsPath, '.pdf')}-${token}.pdf`
        );

        if (!await generateHtml(document, vscode.Uri.file(temporaryHtml))) return;
        await runDeckTape(executable, temporaryHtml, temporaryPdf);

        const pdfStat = await fs.promises.stat(temporaryPdf);
        if (!pdfStat.isFile() || pdfStat.size === 0) {
            throw new Error('DeckTape did not produce a non-empty PDF file.');
        }
        await fs.promises.rename(temporaryPdf, destination.fsPath);
        void vscode.window.showInformationMessage(`Exported presentation: ${destination.fsPath}`);
    } catch (error) {
        void vscode.window.showErrorMessage(`Could not export PDF: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        for (const [label, target, recursive] of [
            ['HTML', temporaryHtml, false],
            ['assets', temporaryAssets, true],
            ['PDF', temporaryPdf, false]
        ] as const) {
            if (!target) continue;
            try {
                await fs.promises.rm(target, { force: true, recursive });
            } catch (error) {
                void vscode.window.showErrorMessage(
                    `Could not remove temporary ${label} export file: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    }
}

function runDeckTape(executable: string, htmlPath: string, pdfPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const deckTapeArgs = ['reveal', '--fragments', pathToFileURL(htmlPath).href, pdfPath];
        const isJavaScriptEntrypoint = /\.(?:cjs|mjs|js)$/i.test(executable);
        const child = spawn(
            isJavaScriptEntrypoint ? process.execPath : executable,
            isJavaScriptEntrypoint ? [executable, ...deckTapeArgs] : deckTapeArgs,
            {
                cwd: path.dirname(htmlPath),
                shell: false,
                stdio: ['ignore', 'ignore', 'pipe'],
                windowsHide: true
            }
        );
        let stderr = '';
        child.stderr?.setEncoding('utf8');
        child.stderr?.on('data', (chunk: string) => {
            stderr = (stderr + chunk).slice(-4096);
        });
        child.once('error', error => {
            const code = (error as NodeJS.ErrnoException).code;
            reject(new Error(code === 'ENOENT'
                ? `DeckTape executable "${executable}" was not found. Install DeckTape or set slidedeck.decktapeExecutable to its path.`
                : `Could not start DeckTape "${executable}": ${error.message}`));
        });
        child.once('close', (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }
            const details = stderr.trim();
            reject(new Error(
                `DeckTape failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}` +
                (details ? `: ${details}` : '.')
            ));
        });
    });
}
