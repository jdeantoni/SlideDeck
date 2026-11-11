// SlideDeck Live Preview Application

// Configuration
const COMPILE_DEBOUNCE_MS = 1000;  // Délai avant compilation après modification
const CURSOR_DEBOUNCE_MS = 500;    // Délai avant compilation après mouvement du curseur
const DEBUG_MEMORY = true;         // Activer les logs de debug mémoire

class SlideDeckApp {
    constructor() {
        this.editor = null;
        this.socket = null;
        this.previewIframe = document.getElementById('preview-iframe');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        this.slideCount = document.getElementById('slide-count');
        this.errorBanner = document.getElementById('error-banner');
        this.errorDetails = document.getElementById('error-details');
        this.errorToggle = document.getElementById('error-toggle');
        this.compileTimeout = null;
        this.currentSlideIndex = 0;
        this.totalSlides = 0;
        this.hasTemplate = false;
        this.isInitialized = false;
        this.currentFilePath = null;
        this.isSaving = false;
        this.revealInitialized = false;
        this.compilationCount = 0;

        this.init();

        // Monitor memory if enabled
        if (DEBUG_MEMORY) {
            this.startMemoryMonitoring();
        }
    }

    async init() {
        await this.initMonaco();
        this.initWebSocket();
        this.initResizer();
        this.initKeyboardShortcuts();
        this.initErrorToggle();
        await this.loadInitialContent();
    }

    initErrorToggle() {
        this.errorToggle.addEventListener('click', () => {
            const isVisible = this.errorDetails.style.display === 'block';
            this.errorDetails.style.display = isVisible ? 'none' : 'block';
            this.errorToggle.textContent = isVisible ? '▼ Show Details' : '▲ Hide Details';
        });
    }

    async initMonaco() {
        return new Promise((resolve) => {
            require.config({
                paths: {
                    'vs': 'https://unpkg.com/monaco-editor@0.44.0/min/vs'
                }
            });

            require(['vs/editor/editor.main'], () => {
                // Define SlideDeck language
                monaco.languages.register({ id: 'slidedeck' });

                // Language configuration for auto-closing and formatting
                monaco.languages.setLanguageConfiguration('slidedeck', {
                    comments: {
                        lineComment: '//',
                        blockComment: ['/*', '*/']
                    },
                    brackets: [
                        ['{', '}'],
                        ['[', ']'],
                        ['(', ')']
                    ],
                    autoClosingPairs: [
                        { open: '{', close: '}' },
                        { open: '[', close: ']' },
                        { open: '(', close: ')' },
                        { open: '"', close: '"' },
                        { open: '**', close: '**' },
                        { open: '*', close: '*' },
                        { open: '__', close: '__' },
                        { open: '```', close: '```' },
                        { open: ':::', close: ':::' }
                    ],
                    surroundingPairs: [
                        { open: '{', close: '}' },
                        { open: '[', close: ']' },
                        { open: '(', close: ')' },
                        { open: '"', close: '"' },
                        { open: '**', close: '**' },
                        { open: '*', close: '*' },
                        { open: '__', close: '__' }
                    ]
                });

                // Register completion provider
                monaco.languages.registerCompletionItemProvider('slidedeck', {
                    provideCompletionItems: (model, position) => {
                        const word = model.getWordUntilPosition(position);
                        const range = {
                            startLineNumber: position.lineNumber,
                            endLineNumber: position.lineNumber,
                            startColumn: word.startColumn,
                            endColumn: word.endColumn
                        };

                        const line = model.getLineContent(position.lineNumber);
                        const lineUpToCursor = line.substring(0, position.column - 1);
                        const isLineStart = lineUpToCursor.trim() === '';

                        const suggestions = [];

                        // Helper function to check if we're inside metadata block
                        const isInsideMetadata = () => {
                            let openBraceFound = false;
                            let closeBraceFound = false;
                            
                            // Scan backwards from current position
                            for (let i = position.lineNumber; i >= 1; i--) {
                                const content = model.getLineContent(i);
                                const checkContent = i === position.lineNumber ? 
                                    content.substring(0, position.column - 1) : content;
                                
                                if (checkContent.includes('}')) {
                                    closeBraceFound = true;
                                    break;
                                }
                                if (checkContent.includes('{')) {
                                    openBraceFound = true;
                                    break;
                                }
                                
                                // If we see slide separator, we're not in metadata
                                if (content.trim() === '===') break;
                                
                                // Don't scan too far
                                if (i < position.lineNumber - 20) break;
                            }
                            
                            return openBraceFound && !closeBraceFound;
                        };

                        // Helper to check if we're inside a slide (after ===)
                        const isInsideSlide = () => {
                            // Scan backwards to see if we've encountered a slide separator
                            for (let i = position.lineNumber - 1; i >= 1; i--) {
                                const content = model.getLineContent(i).trim();
                                if (content === '===') {
                                    return true;
                                }
                                // Don't scan too far
                                if (i < position.lineNumber - 50) break;
                            }
                            return false;
                        };

                        // Helper to get already used metadata fields
                        const getUsedMetadataFields = () => {
                            const usedFields = new Set();
                            if (!isInsideMetadata()) return usedFields;
                            
                            for (let i = Math.max(1, position.lineNumber - 20); i <= Math.min(model.getLineCount(), position.lineNumber + 20); i++) {
                                const content = model.getLineContent(i);
                                const match = content.match(/^\s*(author|title|theme|logo|css|chalkboard(?:-[a-z-]+)?)\s*:/);
                                if (match) {
                                    usedFields.add(match[1]);
                                }
                            }
                            return usedFields;
                        };

                        // If inside metadata, ONLY show metadata field completions
                        const insideMetadata = isInsideMetadata();
                        const insideSlide = isInsideSlide();

                        // Metadata fields (in curly braces context)
                        // RESTRICTION: Only show metadata fields when inside metadata block
                        if (insideMetadata) {
                            const usedFields = getUsedMetadataFields();
                            
                            const metadataFields = [
                                { 
                                    label: 'author', 
                                    detail: 'Author of the presentation', 
                                    documentation: 'The name of the presentation author\n\nExample: author: "John Doe"',
                                    insertText: 'author: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '01'
                                },
                                { 
                                    label: 'title', 
                                    detail: 'Title of the presentation', 
                                    documentation: 'The main title of your presentation\n\nExample: title: "My Awesome Presentation"',
                                    insertText: 'title: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '02'
                                },
                                { 
                                    label: 'theme', 
                                    detail: 'Theme name (optional)', 
                                    documentation: 'Visual theme for the presentation\n\nCommon values: "dark", "light"\n\nExample: theme: "dark"',
                                    insertText: 'theme: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '03'
                                },
                                { 
                                    label: 'logo', 
                                    detail: 'Logo image path (optional)', 
                                    documentation: 'Path to your logo image file\n\nExample: logo: "assets/logo.png"',
                                    insertText: 'logo: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '04'
                                },
                                { 
                                    label: 'css', 
                                    detail: 'Custom CSS file path (optional)', 
                                    documentation: 'Path to custom CSS file for styling\n\nExample: css: "styles/custom.css"',
                                    insertText: 'css: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '05'
                                },
                                { 
                                    label: 'chalkboard', 
                                    detail: 'Enable chalkboard plugin (optional)', 
                                    documentation: 'Enable or disable the chalkboard drawing feature\n\nValues: "true" or "false"\n\nExample: chalkboard: "true"',
                                    insertText: 'chalkboard: "${1|true,false|}"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '10'
                                },
                                { 
                                    label: 'chalkboard-theme', 
                                    detail: 'Chalkboard theme (optional)', 
                                    documentation: 'Visual theme for the chalkboard\n\nExample: chalkboard-theme: "whiteboard"',
                                    insertText: 'chalkboard-theme: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '11'
                                },
                                { 
                                    label: 'chalkboard-boardmarker-width', 
                                    detail: 'Board marker width (optional)', 
                                    documentation: 'Width of the board marker in pixels\n\nExample: chalkboard-boardmarker-width: "3"',
                                    insertText: 'chalkboard-boardmarker-width: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '12'
                                },
                                { 
                                    label: 'chalkboard-chalk-width', 
                                    detail: 'Chalk width (optional)', 
                                    documentation: 'Width of the chalk in pixels\n\nExample: chalkboard-chalk-width: "5"',
                                    insertText: 'chalkboard-chalk-width: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '13'
                                },
                                { 
                                    label: 'chalkboard-chalk-effect', 
                                    detail: 'Chalk effect intensity (optional)', 
                                    documentation: 'Intensity of the chalk effect (0.0 to 1.0)\n\nExample: chalkboard-chalk-effect: "0.5"',
                                    insertText: 'chalkboard-chalk-effect: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '14'
                                },
                                { 
                                    label: 'chalkboard-src', 
                                    detail: 'Chalkboard source file (optional)', 
                                    documentation: 'Path to saved chalkboard data\n\nExample: chalkboard-src: "chalkboard.json"',
                                    insertText: 'chalkboard-src: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '15'
                                },
                                { 
                                    label: 'chalkboard-readonly', 
                                    detail: 'Chalkboard readonly mode (optional)', 
                                    documentation: 'Make chalkboard read-only\n\nValues: "true" or "false"\n\nExample: chalkboard-readonly: "false"',
                                    insertText: 'chalkboard-readonly: "${1|true,false|}"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '16'
                                },
                                { 
                                    label: 'chalkboard-buttons', 
                                    detail: 'Show chalkboard buttons (optional)', 
                                    documentation: 'Display chalkboard control buttons\n\nValues: "true" or "false"\n\nExample: chalkboard-buttons: "true"',
                                    insertText: 'chalkboard-buttons: "${1|true,false|}"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '17'
                                },
                                { 
                                    label: 'chalkboard-transition', 
                                    detail: 'Chalkboard transition duration (optional)', 
                                    documentation: 'Duration of chalkboard transitions in milliseconds\n\nExample: chalkboard-transition: "300"',
                                    insertText: 'chalkboard-transition: "$1"',
                                    kind: monaco.languages.CompletionItemKind.Property,
                                    sortText: '18'
                                }
                            ];

                            // Filter out already used fields
                            const availableFields = metadataFields.filter(field => !usedFields.has(field.label));
                            
                            suggestions.push(...availableFields.map(field => ({
                                ...field,
                                range: range,
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                            })));
                            
                            // RESTRICTION: Return early - only metadata fields allowed inside metadata
                            return { suggestions: suggestions };
                        }

                        // RESTRICTION: Don't allow metadata inside slides
                        // Metadata template (only at document start, NOT after slide separators)
                        if (position.lineNumber <= 5 && isLineStart && !insideSlide) {
                            suggestions.push({
                                label: '{metadata}',
                                kind: monaco,
                                sortText: '100'
                            });
                        }

                        // Headers (ordered: # first, ## second, ### third)
                        if (isLineStart || lineUpToCursor.trim().startsWith('#')) {
                            suggestions.push(
                                {
                                    label: '# Heading 1',
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    detail: 'Level 1 heading',
                                    insertText: '# ',
                                    range: range,
                                    sortText: '101'
                                },
                                {
                                    label: '## Heading 2',
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    detail: 'Level 2 heading',
                                    insertText: '## ',
                                    range: range,
                                    sortText: '102'
                                },
                                {
                                    label: '### Heading 3',
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    detail: 'Level 3 heading',
                                    insertText: '### ',
                                    range: range,
                                    sortText: '103'
                                }
                            );
                        }

                        // Lists (ordered list first, then unordered)
                        if (isLineStart) {
                            suggestions.push(
                                {
                                    label: '1. Ordered item',
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    detail: 'Ordered list item',
                                    insertText: '1. ',
                                    range: range,
                                    sortText: '104'
                                },
                                {
                                    label: '- Unordered item',
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    detail: 'Unordered list item',
                                    insertText: '- ',
                                    range: range,
                                    sortText: '105'
                                },
                                {
                                    label: '* Unordered item',
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    detail: 'Unordered list item (alternative)',
                                    insertText: '* ',
                                    range: range,
                                    sortText: '106'
                                }
                            );
                        }

                        // Quote
                        if (isLineStart) {
                            suggestions.push({
                                label: '> Quote',
                                kind: monaco.languages.CompletionItemKind.Keyword,
                                detail: 'Blockquote',
                                insertText: '> ',
                                range: range,
                                sortText: '107'
                            });
                        }

                        // Code blocks
                        suggestions.push(
                            {
                                label: '```code',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                detail: 'Code block',
                                documentation: 'Insert a code block',
                                insertText: '```${1:language}\n${2:code}\n```',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range,
                                sortText: '200'
                            },
                            {
                                label: '```java[highlight]',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                detail: 'Code block with highlighting',
                                documentation: 'Code block with syntax highlighting options',
                                insertText: '```${1:java}[highlight: ${2|block,function,class,line-by-line,all,none|}]\n${3:code}\n```',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range,
                                sortText: '201'
                            },
                            {
                                label: '```code[lines]',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                detail: 'Code block with line highlighting',
                                documentation: 'Code block with specific lines highlighted',
                                insertText: '```${1:language}[lines: "${2:1,3-5}"]\n${3:code}\n```',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range,
                                sortText: '202'
                            }
                        );

                        // Media
                        suggestions.push({
                            label: '![image]',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            detail: 'Insert image or media',
                            documentation: 'Insert an image or media file',
                            insertText: '![${1:alt text}](${2:path/to/image.png})',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            range: range,
                            sortText: '203'
                        });

                        // Text formatting (bold first, then italic, then underline)
                        suggestions.push(
                            {
                                label: '**bold**',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                detail: 'Bold text',
                                insertText: '**${1:text}**',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range,
                                sortText: '300'
                            },
                            {
                                label: '*italic*',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                detail: 'Italic text',
                                insertText: '*${1:text}*',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range,
                                sortText: '301'
                            },
                            {
                                label: '__underline__',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                detail: 'Underlined text',
                                insertText: '__${1:text}__',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range,
                                sortText: '302'
                            }
                        );

                        // Style delimiters
                        suggestions.push({
                            label: ':::{style}',
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            detail: 'Styled block',
                            documentation: 'Apply custom styles to content',
                            insertText: ':::\n{${1:color: blue}}\n${2:content}\n:::',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            range: range,
                            sortText: '400'
                        });

                        // Sync fragments
                        suggestions.push(
                            {
                                label: ':::[sync-fragments]',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                detail: 'Synchronized fragments',
                                documentation: 'Create synchronized content fragments',
                                insertText: ':::[sync-fragments]\n${1:fragment 1}\n[---]\n${2:fragment 2}\n:::[sync-fragments]',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range,
                                sortText: '500'
                            },
                            {
                                label: ':::[sync-fragments keep]',
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                detail: 'Synchronized fragments (keep)',
                                documentation: 'Create synchronized fragments that keep previous content',
                                insertText: ':::[sync-fragments keep]\n${1:fragment 1}\n[---]\n${2:fragment 2}\n:::[sync-fragments keep]',
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                range: range,
                                sortText: '501'
                            }
                        );

                        return { suggestions: suggestions };
                    }
                });

                // Register hover provider
                monaco.languages.registerHoverProvider('slidedeck', {
                    provideHover: (model, position) => {
                        const word = model.getWordAtPosition(position);
                        const line = model.getLineContent(position.lineNumber);
                        
                        let hoverContent = null;

                        // Detect and provide help for different elements
                        if (line.trim() === '===') {
                            hoverContent = {
                                value: '**Slide Separator**\n\nSeparates slides in the presentation.'
                            };
                        } else if (line.match(/^#{1,3}\s/)) {
                            const level = line.match(/^(#{1,3})/)[1].length;
                            hoverContent = {
                                value: `**Heading Level ${level}**\n\nCreates a level ${level} heading.`
                            };
                        } else if (line.match(/^[-*+]\s/)) {
                            hoverContent = {
                                value: '**Unordered List**\n\nCreates a bullet point in an unordered list.'
                            };
                        } else if (line.match(/^\d+\.\s/)) {
                            hoverContent = {
                                value: '**Ordered List**\n\nCreates a numbered item in an ordered list.'
                            };
                        } else if (line.match(/^>\s/)) {
                            hoverContent = {
                                value: '**Blockquote**\n\nCreates a quoted text block.'
                            };
                        } else if (line.includes('```')) {
                            hoverContent = {
                                value: '**Code Block**\n\nSyntax: \\`\\`\\`language[options]\\`\\`\\`\n\nOptions:\n- `highlight: block|function|class|line-by-line|all|none`\n- `lines: "1,3-5"`\n- `start: 10`'
                            };
                        } else if (line.includes(':::[sync-fragments')) {
                            hoverContent = {
                                value: '**Sync Fragments**\n\nCreate synchronized content that appears sequentially.\n\nUse `[---]` to separate fragments.\nUse `keep` to preserve previous fragments.'
                            };
                        } else if (line.includes(':::')) {
                            hoverContent = {
                                value: '**Style Delimiter**\n\nApply custom CSS styles to a block of content.\n\nExample: `{color: blue; font-size: 24px}`'
                            };
                        } else if (word && ['author', 'title', 'theme', 'logo', 'css', 'chalkboard'].includes(word.word)) {
                            const docs = {
                                'author': 'The author of the presentation',
                                'title': 'The title of the presentation',
                                'theme': 'The theme name (e.g., "dark", "light")',
                                'logo': 'Path to the logo image file',
                                'css': 'Path to custom CSS file',
                                'chalkboard': 'Enable chalkboard plugin ("true"/"false")'
                            };
                            hoverContent = {
                                value: `**${word.word}**\n\n${docs[word.word] || 'Metadata property'}`
                            };
                        }

                        if (hoverContent) {
                            return {
                                contents: [hoverContent]
                            };
                        }

                        return null;
                    }
                });

                // Set language syntax highlighting
                monaco.languages.setMonarchTokensProvider('slidedeck', {
                    tokenizer: {
                        root: [
                            [/^\s*```.*$/, { token: 'string.code', next: '@codeBlock' }],
                            [/^\s*\/\/.*$/, 'comment'],
                            [/^\s*\/\*/, { token: 'comment', next: '@blockComment' }],
                            [/^===\s*$/, 'delimiter.slide'],
                            [/^---\s*$/, 'delimiter.template'],
                            [/^#{1,3}\s+.*$/, 'keyword.heading'],
                            [/^\s*[-*+]\s+/, 'keyword.list'],
                            [/^\s*\d+\.\s+/, 'keyword.list'],
                            [/^>\s+.*$/, 'comment.quote'],
                            [/!\[.*?\]\(.*?\)/, 'string.media'],
                            [/\*\*.*?\*\*/, 'strong'],
                            [/\*.*?\*/, 'emphasis'],
                            [/__.*?__/, 'string.underline'],
                            [/:::/, 'delimiter.style'],
                            [/\{[^}]*\}/, 'attribute'],
                        ],
                        blockComment: [
                            [/\*\//, { token: 'comment', next: '@pop' }],
                            [/[^*]+|\*/, 'comment']
                        ],
                        codeBlock: [
                            [/^\s*```\s*$/, { token: 'string.code', next: '@pop' }],
                            [/.+/, 'string.code']
                        ]
                    }
                });

                // Define theme
                monaco.editor.defineTheme('slidedeck-theme', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [
                        { token: 'delimiter.slide', foreground: 'ff6b6b', fontStyle: 'bold' },
                        { token: 'delimiter.template', foreground: '4ecdc4', fontStyle: 'bold' },
                        { token: 'keyword.heading', foreground: '95e1d3', fontStyle: 'bold' },
                        { token: 'keyword.list', foreground: 'ffe66d' },
                        { token: 'comment.quote', foreground: '6c757d', fontStyle: 'italic' },
                        { token: 'string.media', foreground: '9d4edd' },
                        { token: 'strong', foreground: 'ff9f1c', fontStyle: 'bold' },
                        { token: 'emphasis', foreground: '80ed99', fontStyle: 'italic' },
                        { token: 'string.underline', foreground: '57cc99', fontStyle: 'underline' },
                        { token: 'string.code', foreground: 'd4a5a5' },
                        { token: 'delimiter.style', foreground: 'c77dff' },
                        { token: 'attribute', foreground: 'ffd60a' },
                    ],
                    colors: {}
                });

                // Create editor
                this.editor = monaco.editor.create(document.getElementById('editor-container'), {
                    value: '# Loading...',
                    language: 'slidedeck',
                    theme: 'slidedeck-theme',
                    fontSize: 14,
                    lineNumbers: 'on',
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on'
                });

                // Listen to content changes
                this.editor.onDidChangeModelContent(() => {
                    this.onEditorChange();
                });

                // Listen to cursor position changes
                this.editor.onDidChangeCursorPosition(() => {
                    this.onCursorChange();
                });

                resolve();
            });
        });
    }

    initWebSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateStatus('ready', 'Connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('error', 'Disconnected');
        });

        this.socket.on('compilation-result', (result) => {
            this.handleCompilationResult(result);
        });

        this.socket.on('compilation-error', (data) => {
            this.handleCompilationError(data.error);
        });
    }

    initResizer() {
        const resizer = document.querySelector('.resizer');
        const editorPanel = document.querySelector('.editor-panel');
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const containerWidth = document.querySelector('.container').offsetWidth;
            const newWidth = (e.clientX / containerWidth) * 100;

            if (newWidth > 20 && newWidth < 80) {
                editorPanel.style.flex = `0 0 ${newWidth}%`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    async loadInitialContent() {
        try {
            const response = await fetch('/api/initial-content');
            const data = await response.json();
            this.editor.setValue(data.content);
            this.currentFilePath = data.filePath;

            // Update title if we have a file path
            if (this.currentFilePath) {
                const fileName = this.currentFilePath.split('/').pop();
                document.title = `${fileName} - SlideDeck`;
            }

            // Trigger initial compilation
            this.compile();
        } catch (error) {
            console.error('Failed to load initial content:', error);
            this.updateStatus('error', 'Failed to load');
        }
    }

    initKeyboardShortcuts() {
        // Capture Ctrl+S / Cmd+S for saving
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveFile();
            }
        });
    }

    async saveFile() {
        if (this.isSaving) return;

        if (!this.currentFilePath) {
            this.showNotification('No file path available. Start with: npm run dev <file>', 'error');
            return;
        }

        this.isSaving = true;
        this.updateStatus('compiling', 'Saving...');

        try {
            const content = this.editor.getValue();

            const response = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content,
                    filePath: this.currentFilePath
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(result.message, 'success');
                this.updateStatus('ready', 'Saved');

                // Reset status back to "Ready" after 2 seconds
                setTimeout(() => {
                    this.updateStatus('ready', 'Ready');
                }, 2000);
            } else {
                this.showNotification('Save failed: ' + result.error, 'error');
                this.updateStatus('error', 'Save failed');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showNotification('Save failed: ' + error.message, 'error');
            this.updateStatus('error', 'Save failed');
        } finally {
            this.isSaving = false;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    onEditorChange() {
        // Debounce compilation
        clearTimeout(this.compileTimeout);
        this.updateStatus('compiling', 'Compiling...');

        this.compileTimeout = setTimeout(() => {
            this.compile();
        }, COMPILE_DEBOUNCE_MS);
    }

    onCursorChange() {
        // When cursor moves, we might want to compile to update the slide view
        // But only if we're not already compiling
        if (!this.compileTimeout) {
            clearTimeout(this.compileTimeout);
            this.compileTimeout = setTimeout(() => {
                this.compile();
            }, CURSOR_DEBOUNCE_MS);
        }
    }

    compile() {
        const content = this.editor.getValue();
        const position = this.editor.getPosition();
        const cursorLine = position ? position.lineNumber - 1 : 0; // Convert to 0-based

        this.socket.emit('compile', { content, cursorLine });
    }

    handleCompilationResult(result) {
        if (result.error) {
            this.handleCompilationError(result.error);
            return;
        }

        // Hide error banner
        this.errorBanner.style.display = 'none';

        // Update slide count
        this.totalSlides = result.slideCount;
        this.hasTemplate = result.hasTemplate || false;
        this.currentSlideIndex = result.slideIndex !== undefined ? result.slideIndex : 0;

        // Calculate reveal.js slide index (add 1 if there's a template)
        const revealSlideIndex = this.hasTemplate ? this.currentSlideIndex + 1 : this.currentSlideIndex;

        // Update preview (will update slide count after navigation)
        this.updatePreview(result.html, revealSlideIndex);

        // Update status
        this.updateStatus('ready', 'Ready');

        // Mark as initialized after first successful compilation
        if (!this.isInitialized) {
            this.isInitialized = true;
        }
    }

    handleCompilationError(error) {
        this.updateStatus('error', 'Error');

        // Show error banner at top
        this.errorDetails.textContent = error + '\n\n💡 Tip: Fix the errors and the preview will update automatically.';
        this.errorBanner.style.display = 'block';

        // Keep the details collapsed by default
        this.errorDetails.style.display = 'none';
        this.errorToggle.textContent = '▼ Show Details';
    }

    updatePreview(html, slideIndex) {
        this.compilationCount++;

        if (DEBUG_MEMORY) {
            console.log(`[Preview Update #${this.compilationCount}] Navigating to slide ${slideIndex}`);
        }

        // Strategy: Replace the entire iframe to ensure clean slate
        // This is more aggressive but prevents memory leaks
        const oldIframe = this.previewIframe;
        const newIframe = document.createElement('iframe');

        // Copy attributes
        newIframe.id = 'preview-iframe';
        newIframe.sandbox = 'allow-scripts allow-same-origin allow-popups';

        // Replace the iframe
        oldIframe.parentNode.replaceChild(newIframe, oldIframe);
        this.previewIframe = newIframe;

        if (DEBUG_MEMORY) {
            console.log('[Preview] Iframe replaced, writing HTML...');
        }

        // Write content to new iframe
        const iframeDoc = newIframe.contentDocument || newIframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        // Wait for Reveal.js to initialize with retry mechanism
        this.waitForRevealAndNavigate(slideIndex, 0);

        // Force garbage collection hint (not guaranteed but helps)
        if (window.gc) {
            setTimeout(() => window.gc(), 500);
        }
    }

    waitForRevealAndNavigate(slideIndex, retryCount = 0) {
        const maxRetries = 10;
        const retryDelay = 100;

        setTimeout(() => {
            const iframeWindow = this.previewIframe.contentWindow;

            if (iframeWindow && iframeWindow.Reveal) {
                this.revealInitialized = true;

                // Navigate to the specific slide
                iframeWindow.Reveal.slide(slideIndex, 0);

                // Get the actual current slide after navigation
                const indices = iframeWindow.Reveal.getIndices();

                // Update the counter (subtract 1 if there's a template to get back to 0-based slide index)
                const actualSlideIndex = this.hasTemplate ? indices.h - 1 : indices.h;
                this.currentSlideIndex = Math.max(0, actualSlideIndex);
                this.updateSlideCount();

                // Listen to slide changes in the preview (user navigation)
                iframeWindow.Reveal.on('slidechanged', (event) => {
                    // Adjust for template
                    const userSlideIndex = this.hasTemplate ? event.indexh - 1 : event.indexh;
                    this.currentSlideIndex = Math.max(0, userSlideIndex);
                    this.updateSlideCount();
                });

                if (DEBUG_MEMORY) {
                    console.log(`[Preview] Reveal.js initialized after ${retryCount} retries, navigated to slide ${slideIndex}`);
                }
            } else if (retryCount < maxRetries) {
                // Retry
                if (DEBUG_MEMORY && retryCount === 0) {
                    console.log('[Preview] Reveal.js not ready, retrying...');
                }
                this.waitForRevealAndNavigate(slideIndex, retryCount + 1);
            } else {
                console.warn('[Preview] Reveal.js failed to initialize after max retries');
            }
        }, retryDelay);
    }

    updateSlideCount() {
        this.slideCount.textContent = `Slide ${this.currentSlideIndex + 1} / ${this.totalSlides}`;
    }

    updateStatus(type, text) {
        this.statusIndicator.className = `status-dot ${type}`;
        this.statusText.textContent = text;
    }

    startMemoryMonitoring() {
        // Log memory usage every 5 seconds
        setInterval(() => {
            if (performance.memory) {
                const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
                const total = (performance.memory.totalJSHeapSize / 1048576).toFixed(2);
                const limit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
                console.log(`[Memory] Used: ${used} MB / Total: ${total} MB / Limit: ${limit} MB | Compilations: ${this.compilationCount}`);
            }
        }, 5000);
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SlideDeckApp();
    });
} else {
    new SlideDeckApp();
}
