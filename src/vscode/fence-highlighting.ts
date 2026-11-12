import * as vscode from 'vscode';
import { AstNode, streamAllContents } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { createSlideDeckServices } from '../language/slide-deck-module';
import { isFragmentElement, isNestedStyledElement, isStyledElement } from '../language/generated/ast';

export function registerFenceHighlighting(): vscode.Disposable {
    const parser = createSlideDeckServices(NodeFileSystem).SlideDeck.parser.LangiumParser;
    const colors = Array.from({ length: 6 }, (_, index) => vscode.window.createTextEditorDecorationType({
        color: new vscode.ThemeColor(`editorBracketHighlight.foreground${index + 1}`)
    }));
    const matching = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editorBracketMatch.background'),
        borderColor: new vscode.ThemeColor('editorBracketMatch.border'),
        borderWidth: '1px',
        borderStyle: 'solid'
    });

    function update(editor: vscode.TextEditor): void {
        if (editor.document.languageId !== 'slidedeck') return;
        const result = parser.parse(editor.document.getText());
        const ranges: vscode.Range[][] = colors.map(() => []);
        let selected: vscode.Range[] = [];
        if (!result.lexerErrors.length && !result.parserErrors.length) {
            for (const node of streamAllContents(result.value)) {
                if (!(isStyledElement(node) || isNestedStyledElement(node) || isFragmentElement(node))) continue;
                const cst = node.$cstNode;
                if (!cst) continue;
                let depth = 0;
                let parent: AstNode | undefined = node.$container;
                while (parent) {
                    if (isStyledElement(parent) || isNestedStyledElement(parent) || isFragmentElement(parent)) depth++;
                    parent = parent.$container;
                }
                const openingLength = isNestedStyledElement(node) ? 4 : 3;
                const start = editor.document.positionAt(cst.offset);
                const open = new vscode.Range(start, editor.document.positionAt(cst.offset + openingLength));
                const closing = /:::[ \t]+end$/.exec(cst.text);
                if (!closing) continue;
                const close = new vscode.Range(editor.document.positionAt(cst.end - closing[0].length), editor.document.positionAt(cst.end));
                ranges[depth % colors.length].push(open, close);
                if (editor.selections.some(selection => open.contains(selection.active) || close.contains(selection.active))) {
                    selected = selected.concat(open, close);
                }
            }
        }
        colors.forEach((type, index) => editor.setDecorations(type, ranges[index]));
        editor.setDecorations(matching, selected);
    }

    const refresh = (document?: vscode.TextDocument): void => {
        for (const editor of vscode.window.visibleTextEditors) {
            if (!document || editor.document === document) update(editor);
        }
    };
    const subscriptions = [
        ...colors, matching,
        vscode.workspace.onDidChangeTextDocument(event => refresh(event.document)),
        vscode.window.onDidChangeTextEditorSelection(event => update(event.textEditor)),
        vscode.window.onDidChangeVisibleTextEditors(() => refresh())
    ];
    refresh();
    return vscode.Disposable.from(...subscriptions);
}
