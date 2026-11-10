import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CompilerService } from '../services/compiler-service';

export async function compileHtml(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'slidedeckml') {
        void vscode.window.showErrorMessage('Open a SlideDeckML file before compiling.');
        return;
    }
    const document = editor.document;
    if (document.uri.scheme !== 'file') {
        void vscode.window.showErrorMessage('Save the SlideDeckML file locally before compiling.');
        return;
    }
    if (!vscode.workspace.isTrusted) {
        void vscode.window.showErrorMessage('Trust this workspace before compiling a SlideDeckML file.');
        return;
    }

    try {
        const sourcePath = document.uri.fsPath;
        const defaultName = path.basename(sourcePath, path.extname(sourcePath)) + '.html';
        const destination = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(path.dirname(sourcePath), defaultName)),
            filters: { 'HTML': ['html'] },
            saveLabel: 'Generate HTML'
        });
        if (!destination) return;
        if (destination.scheme !== 'file' || path.extname(destination.fsPath).toLowerCase() !== '.html') {
            void vscode.window.showErrorMessage('Choose a local .html file for the generated presentation.');
            return;
        }

        const sourceStat = await fs.promises.stat(sourcePath);
        let destinationStat: fs.Stats | undefined;
        try {
            destinationStat = await fs.promises.stat(destination.fsPath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        if (destinationStat && sourceStat.dev === destinationStat.dev && sourceStat.ino === destinationStat.ino) {
            void vscode.window.showErrorMessage('The generated HTML must not replace the source file.');
            return;
        }

        const source = document.getText();
        const result = await new CompilerService().compile(source, undefined, sourcePath, undefined, destination.fsPath);
        if (result.error) {
            void vscode.window.showErrorMessage(`Could not compile presentation: ${result.error}`);
            return;
        }
        await fs.promises.writeFile(destination.fsPath, result.html, 'utf8');
        void vscode.window.showInformationMessage(`Generated presentation: ${destination.fsPath}`);
    } catch (error) {
        void vscode.window.showErrorMessage(`Could not generate presentation: ${error instanceof Error ? error.message : String(error)}`);
    }
}
