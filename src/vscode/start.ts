import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import * as vscode from 'vscode';
import { generateHtml, getPresentationDocument } from './compile';

export async function startPresentation(): Promise<void> {
    const document = getPresentationDocument();
    if (!document) return;
    if (vscode.env.remoteName) {
        void vscode.window.showErrorMessage('Starting a local browser is not supported in remote workspaces. Generate HTML and open it locally instead.');
        return;
    }
    try {
        const source = document.uri.fsPath;
        const output = path.join(path.dirname(source), path.basename(source, path.extname(source)) + '.html');
        const config = vscode.workspace.getConfiguration('slidedeck');
        const executable = config.get<string>('browserExecutable', 'firefox').trim();
        const args = config.get<string[]>('browserArguments', ['--new-window']);
        if (!executable || !Array.isArray(args) || args.some(arg => typeof arg !== 'string')) {
            throw new Error('Configure a browser executable and an array of browser arguments in SlideDeck settings.');
        }
        let exists = false;
        try {
            await fs.promises.lstat(output);
            exists = true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        if (exists) {
            const choice = await vscode.window.showWarningMessage(
                `Replace the existing presentation ${output}?`,
                { modal: true },
                'Replace and Start'
            );
            if (choice !== 'Replace and Start') return;
        }
        if (!await generateHtml(document, vscode.Uri.file(output))) return;
        const child = spawn(executable, [...args, pathToFileURL(output).href], {
            detached: true,
            stdio: 'ignore',
            shell: false
        });
        child.once('error', error => {
            void vscode.window.showErrorMessage(`Could not start browser "${executable}": ${error.message}`);
        });
        child.once('exit', (code, signal) => {
            if (code !== null && code !== 0) {
                void vscode.window.showErrorMessage(`Browser "${executable}" exited with code ${code}.`);
            } else if (signal) {
                void vscode.window.showErrorMessage(`Browser "${executable}" terminated with signal ${signal}.`);
            }
        });
        child.unref();
    } catch (error) {
        void vscode.window.showErrorMessage(`Could not start presentation: ${error instanceof Error ? error.message : String(error)}`);
    }
}
