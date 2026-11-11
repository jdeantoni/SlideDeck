/**
 * IDE Runtime Generator
 * Generates the JavaScript runtime code for Monaco Editor and Pyodide integration
 */
export class IdeRuntimeGenerator {
    private hasIdeElements: boolean = false;

    /**
     * Enable IDE runtime
     */
    public enable(): void {
        this.hasIdeElements = true;
    }

    /**
     * Check if IDE runtime is enabled
     */
    public isEnabled(): boolean {
        return this.hasIdeElements;
    }

    /**
     * Generate IDE-related CSS styles
     * @returns CSS code as a string
     */
    public generateStyles(): string {
        if (!this.hasIdeElements) return '';

        return `
        .ide-editor-container, .ide-output-container {
            display: inline-block;
            vertical-align: top;
            margin: 0.5em;
            position: relative;
        }

        [style*="position: absolute"] > .ide-editor-container,
        [style*="position: absolute"] > .ide-output-container {
            margin: 0;
        }
        .monaco-editor-wrapper {
            border-radius: 4px;
            overflow: hidden;
        }
        .run-button {
            position: absolute;
            top: -40px;
            left: 0;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            padding: 8px 16px;
            cursor: pointer;
            z-index: 10;
        }
        .run-button:hover {
            background: #005a9e;
        }
        .output-header {
            border-radius: 4px 4px 0 0;
        }
        .output-content {
            border-radius: 4px;
            border: 1px solid #3c3c3c;
            overflow-y: auto;
            overflow-x: auto;
            max-height: 350px;
        }
        .output-content:empty::before {
            content: 'Output';
            color: #6c6c6c;
            font-style: italic;
        }
        section:not([style*="position: absolute"]) .ide-editor-container,
        section:not([style*="position: absolute"]) .ide-output-container {
            text-align: left;
        }`;
    }

    /**
     * Generate IDE-related CDN links
     * @returns HTML string with CDN links
     */
    public generateCdnLinks(): string {
        if (!this.hasIdeElements) return '';
        return `    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css">`;
    }

    /**
     * Generate IDE-related script tags
     * @returns HTML string with script tags
     */
    public generateScriptTags(): string {
        if (!this.hasIdeElements) return '';
        return `    <!-- Pyodide -->
    <script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>

    <!-- SQL.js for SQL execution -->
    <script src="https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js"></script>`;
    }

    /**
     * Generate the Monaco Editor loader script tag
     * @returns HTML string with Monaco loader script tag only
     */
    public generateMonacoLoaderScript(): string {
        if (!this.hasIdeElements) return '';
        return `    <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>`;
    }

    /**
     * Generate the Monaco Editor initialization code
     * @returns JavaScript code as a string
     */
    public generateMonacoEditorScript(): string {
        if (!this.hasIdeElements) return '';
        
        return `        function showIdeLoadError(error) {
            const message = 'Could not load the code editor. Check network access and reload the presentation.';
            document.querySelectorAll('.monaco-editor-wrapper').forEach(element => {
                element.textContent = message;
            });
            document.querySelectorAll('.run-button').forEach(button => { button.disabled = true; });
            console.error(message, error);
        }
        window.monacoEditors = {};

        if (!window.ResizeObserver && typeof ResizeObserver !== 'undefined') {
            window.ResizeObserver = ResizeObserver;
        }

        if (typeof require !== 'function' || typeof require.config !== 'function') {
            showIdeLoadError('Monaco loader unavailable');
        } else {
        require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            document.querySelectorAll('.monaco-editor-wrapper').forEach(editorElement => {
                const editorId = editorElement.id;
                const language = editorElement.getAttribute('data-language') || 'python';
                const initialCode = editorElement.getAttribute('data-initial-code') || '# Write your ' + language + ' code here\\n';

                window.monacoEditors[editorId] = monaco.editor.create(editorElement, {
                    value: initialCode,
                    language: language,
                    theme: 'vs-dark',
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    automaticLayout: true
                });
            });

            document.querySelectorAll('.run-button').forEach(button => {
                button.addEventListener('click', async function() {
                    const editorId = this.getAttribute('data-editor-id');
                    const editor = window.monacoEditors[editorId];

                    if (!editor) {
                        console.error('Editor not found:', editorId);
                        return;
                    }

                    const code = editor.getValue();
                    const editorElement = document.getElementById(editorId);
                    const language = editorElement.getAttribute('data-language');
                    const outputId = editorElement.getAttribute('data-output-id');
                    const outputElement = document.getElementById(outputId);

                    if (!outputElement) {
                        console.error('Output element not found:', outputId);
                        return;
                    }

                    if (language === 'python') {
                        await runPythonCode(code, outputElement);
                    } else if (language === 'javascript') {
                        runJavaScriptCode(code, outputElement);
                    } else if (language === 'sql') {
                        await runSQLCode(code, outputElement);
                    }
                });
            });
        }, showIdeLoadError);
        }

        async function runPythonCode(code, outputElement) {
            try {
                if (!window.pyodideReady) {
                    outputElement.textContent = 'Loading Pyodide...\\n';

                    if (!window.pyodideLoading) {
                        window.pyodideLoading = loadPyodide({
                            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
                        }).then(async pyodide => {
                            // Load common packages
                            await pyodide.loadPackage(['numpy', 'matplotlib']);
                            window.pyodide = pyodide;
                            window.pyodideReady = true;
                            return pyodide;
                        });
                    }

                    await window.pyodideLoading;
                }

                const pyodide = window.pyodide;

                pyodide.runPython(\`
import sys
from io import StringIO, BytesIO
import matplotlib
import matplotlib.pyplot as plt
import base64

matplotlib.use('Agg')

sys.stdout = StringIO()

plt.close('all')
                \`);

                await pyodide.runPythonAsync(code);

                const textOutput = pyodide.runPython('sys.stdout.getvalue()');

                const figures = pyodide.runPython(\`
import matplotlib.pyplot as plt
figures_data = []
for i in plt.get_fignums():
    fig = plt.figure(i)
    buf = BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    figures_data.append(img_base64)
    buf.close()
figures_data
                \`);

                outputElement.innerHTML = '';
                outputElement.style.color = '#d4d4d4';

                if (textOutput) {
                    const textNode = document.createTextNode(textOutput);
                    outputElement.appendChild(textNode);
                }

                if (figures && figures.length > 0) {
                    figures.forEach(imgData => {
                        const img = document.createElement('img');
                        img.src = 'data:image/png;base64,' + imgData;
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                        img.style.display = 'block';
                        img.style.margin = '10px 0';
                        outputElement.appendChild(img);
                    });
                } else if (!textOutput) {
                    outputElement.textContent = '(No output)';
                }

            } catch (error) {
                outputElement.textContent = 'Error: ' + error.message;
                outputElement.style.color = '#ff6b6b';
            }
        }

        function runJavaScriptCode(code, outputElement) {
            const originalLog = console.log;
            try {
                const logs = [];
                console.log = (...args) => {
                    logs.push(args.map(a => String(a)).join(' '));
                    originalLog.apply(console, args);
                };

                const result = eval(code);

                let output = logs.join('\\n');
                if (result !== undefined && logs.length === 0) {
                    output = String(result);
                }
                outputElement.textContent = output || '(No output)';
                outputElement.style.color = '#d4d4d4';

            } catch (error) {
                outputElement.textContent = 'Error: ' + error.message;
                outputElement.style.color = '#ff6b6b';
            } finally {
                console.log = originalLog;
            }
        }

        async function runSQLCode(code, outputElement) {
            try {
                if (!window.sqlReady) {
                    outputElement.textContent = 'Loading SQL.js...\\n';

                    if (!window.sqlLoading) {
                        window.sqlLoading = initSqlJs({
                            locateFile: file => \`https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/\${file}\`
                        }).then(SQL => {
                            window.SQL = SQL;
                            window.sqlReady = true;
                            return SQL;
                        });
                    }

                    await window.sqlLoading;
                }

                const SQL = window.SQL;

                const db = new SQL.Database();

                const statements = code.trim().split(';').filter(stmt => stmt.trim());

                outputElement.innerHTML = '';
                outputElement.style.color = '#d4d4d4';

                let hasResults = false;

                for (let i = 0; i < statements.length; i++) {
                    const stmt = statements[i].trim();
                    if (!stmt) continue;

                    try {
                        const results = db.exec(stmt);

                        if (results.length > 0) {
                            hasResults = true;
                            results.forEach(result => {
                                const table = formatSQLResults(result);
                                outputElement.appendChild(table);
                            });
                        } else if (stmt.toUpperCase().startsWith('SELECT')) {
                            hasResults = true;
                            const emptyMsg = document.createElement('div');
                            emptyMsg.textContent = 'Query returned 0 rows';
                            emptyMsg.style.marginBottom = '10px';
                            outputElement.appendChild(emptyMsg);
                        } else {
                            hasResults = true;
                            const successMsg = document.createElement('div');
                            successMsg.textContent = 'Query executed successfully';
                            successMsg.style.marginBottom = '10px';
                            successMsg.style.color = '#4CAF50';
                            outputElement.appendChild(successMsg);
                        }
                    } catch (stmtError) {
                        hasResults = true;
                        const errorMsg = document.createElement('div');
                        errorMsg.textContent = 'Error: ' + stmtError.message;
                        errorMsg.style.color = '#ff6b6b';
                        errorMsg.style.marginBottom = '10px';
                        outputElement.appendChild(errorMsg);
                    }
                }

                if (!hasResults) {
                    outputElement.textContent = '(No output)';
                }

                db.close();

            } catch (error) {
                outputElement.textContent = 'Error: ' + error.message;
                outputElement.style.color = '#ff6b6b';
            }
        }

        function formatSQLResults(result) {
            const table = document.createElement('table');
            table.style.borderCollapse = 'collapse';
            table.style.marginBottom = '10px';
            table.style.width = '100%';
            table.style.fontSize = '0.9em';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            result.columns.forEach(col => {
                const th = document.createElement('th');
                th.textContent = col;
                th.style.border = '1px solid #555';
                th.style.padding = '8px';
                th.style.backgroundColor = '#2d2d2d';
                th.style.textAlign = 'left';
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            result.values.forEach(row => {
                const tr = document.createElement('tr');
                row.forEach(cell => {
                    const td = document.createElement('td');
                    td.textContent = cell !== null ? cell : 'NULL';
                    td.style.border = '1px solid #555';
                    td.style.padding = '8px';
                    if (cell === null) {
                        td.style.fontStyle = 'italic';
                        td.style.color = '#888';
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);

            return table;
        }`;
    }
}
