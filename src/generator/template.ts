import { Metadata } from '../language/generated/ast';
import { ImageConverter } from './image-converter';
import { IdeRuntimeGenerator } from './ide-runtime';
import { PollGenerator } from './poll-generator';
import * as path from 'path';

export class TemplateGenerator {
    private ideRuntime: IdeRuntimeGenerator;
    private title: string = 'SlideDeck Presentation'
    private author: string = 'Unknown Author'
    private css: string = ''
    private logo: string = ''
    private theme: string = 'white'
    private transition: string = 'slide'
    private sourceFilePath?: string;

    // Feature usage tracking
    private useSyncFragments: boolean = false;
    private useLatex: boolean = false;

    // Chalkboard configuration
    private chalkboardEnabled: boolean = false;
    private chalkboardTheme: string = 'chalkboard';
    private chalkboardBoardmarkerWidth: number = 3;
    private chalkboardChalkWidth: number = 7;
    private chalkboardChalkEffect: number = 1.0;
    private chalkboardSrc: string = '';
    private chalkboardReadonly: boolean = false;
    private chalkboardButtons: boolean = true;
    private chalkboardTransition: number = 800;

    private hasInteractiveElements: boolean = false
    private pollGenerator: PollGenerator

    constructor(pollGenerator: PollGenerator, ideRuntime: IdeRuntimeGenerator) {
        this.pollGenerator = pollGenerator
        this.ideRuntime = ideRuntime
    }

    /**
     * Set the source file path for resolving relative paths
     * @param filePath Absolute path to the .sdml file
     */
    public setSourceFilePath(filePath: string): void {
        this.sourceFilePath = filePath;
    }

    /**
     * Enable synchronized fragments JavaScript
     */
    public enableSyncFragments(): void {
        this.useSyncFragments = true;
    }

    /**
     * Enable LaTeX rendering JavaScript
     */
    public enableLatex(): void {
        this.useLatex = true;
    }

    /**
     * Get the IDE runtime generator instance
     * @returns The IDE runtime generator
     */
    public getIdeRuntime(): IdeRuntimeGenerator {
        return this.ideRuntime;
    }

    public setMetadata(metadata: Metadata): void {
        // Access author and title directly from the metadata object
        this.author = metadata.author.replace(/^"|"$/g, '')
        this.title = metadata.title.replace(/^"|"$/g, '')
        if (metadata.css) {
            this.css = metadata.css.replace(/^"|"$/g, '')
        }
        if (metadata.logo) {
            this.logo = metadata.logo.replace(/^"|"$/g, '')
        }
        if (metadata.theme) {
            this.theme = metadata.theme.replace(/^"|"$/g, '')
        }
        this.transition = metadata.transition === undefined
            ? 'slide' : metadata.transition.replace(/^"|"$/g, '');
        
        // Chalkboard configuration
        if (metadata.chalkboard) {
            const enabled = metadata.chalkboard.replace(/^"|"$/g, '').toLowerCase();
            this.chalkboardEnabled = enabled === 'true' || enabled === 'yes' || enabled === '1';
        }
        if (metadata.chalkboardTheme) {
            this.chalkboardTheme = metadata.chalkboardTheme.replace(/^"|"$/g, '');
        }
        if (metadata.chalkboardBoardmarkerWidth) {
            this.chalkboardBoardmarkerWidth = parseFloat(metadata.chalkboardBoardmarkerWidth.replace(/^"|"$/g, ''));
        }
        if (metadata.chalkboardChalkWidth) {
            this.chalkboardChalkWidth = parseFloat(metadata.chalkboardChalkWidth.replace(/^"|"$/g, ''));
        }
        if (metadata.chalkboardChalkEffect) {
            this.chalkboardChalkEffect = parseFloat(metadata.chalkboardChalkEffect.replace(/^"|"$/g, ''));
        }
        if (metadata.chalkboardSrc) {
            this.chalkboardSrc = metadata.chalkboardSrc.replace(/^"|"$/g, '');
        }
        if (metadata.chalkboardReadonly) {
            const readonly = metadata.chalkboardReadonly.replace(/^"|"$/g, '').toLowerCase();
            this.chalkboardReadonly = readonly === 'true' || readonly === 'yes' || readonly === '1';
        }
        if (metadata.chalkboardButtons) {
            const buttons = metadata.chalkboardButtons.replace(/^"|"$/g, '').toLowerCase();
            this.chalkboardButtons = buttons === 'true' || buttons === 'yes' || buttons === '1';
        }
        if (metadata.chalkboardTransition) {
            this.chalkboardTransition = parseFloat(metadata.chalkboardTransition.replace(/^"|"$/g, ''));
        }
    }

    public setHasInteractiveElements(hasInteractiveElements: boolean): void {
        this.hasInteractiveElements = hasInteractiveElements
    }

    /**
     * Get chalkboard plugin CDN links
     * @returns HTML string with CDN links for chalkboard dependencies
     */
    private getChalkboardCDNLinks(): { css: string; js: string } {
        return {
            css: `<!-- Font Awesome (required for chalkboard) -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Custom controls plugin -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js-plugins@latest/customcontrols/style.css">
    <!-- Chalkboard plugin -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js-plugins@latest/chalkboard/style.css">`,
            js: `<!-- Font Awesome (required for chalkboard) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
    <!-- Custom controls plugin -->
    <script src="https://cdn.jsdelivr.net/npm/reveal.js-plugins@latest/customcontrols/plugin.js"></script>
    <!-- Chalkboard plugin -->
    <script src="https://cdn.jsdelivr.net/npm/reveal.js-plugins@latest/chalkboard/plugin.js"></script>`
        };
    }

    /**
     * Generate chalkboard configuration object
     * @returns Configuration object for RevealChalkboard
     */
    private getChalkboardConfig(): string {
        if (!this.chalkboardEnabled) {
            return '';
        }

        const config: any = {
            theme: this.chalkboardTheme,
            boardmarkerWidth: this.chalkboardBoardmarkerWidth,
            chalkWidth: this.chalkboardChalkWidth,
            chalkEffect: this.chalkboardChalkEffect,
            readOnly: this.chalkboardReadonly,
            buttons: this.chalkboardButtons,
            transition: this.chalkboardTransition
        };

        if (this.chalkboardSrc) {
            config.src = this.chalkboardSrc;
        }

        return JSON.stringify(config, null, 12);
    }


    public getHTMLTemplate(slidesContent: string, useUrlHash: boolean = true): string {
        const chalkboardCDN = this.chalkboardEnabled ? this.getChalkboardCDNLinks() : { css: '', js: '' };
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="author" content="${this.author}">
    <meta name="title" content="${this.title}">
    <title>${this.title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/reveal.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/theme/${
        this.theme
    }.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/plugin/highlight/monokai.css">
    ${this.useLatex ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">' : ''}
    ${this.chalkboardEnabled ? chalkboardCDN.css : ''}
    ${this.ideRuntime.generateCdnLinks()}
    ${this.hasInteractiveElements ? `
    <!-- Poll plugin -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js-plugins@latest/poll/style.css">
    ` : ''}
    <style>
        .reveal .slides > .sd-annotation-layer {
            position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20;
        }
        .reveal .slides > .sd-annotation-layer img {
            display: block; width: 100%; height: 100%; max-width: none; max-height: none;
            margin: 0; border: 0; box-shadow: none;
        }
        .reveal [data-sd-note]::after {
            content: "i";
            display: inline-block;
            box-sizing: border-box;
            width: 1.15em;
            height: 1.15em;
            margin-left: 0.25em;
            border: 1px solid currentColor;
            border-radius: 50%;
            font: bold 0.55em/1 sans-serif;
            text-align: center;
            vertical-align: super;
        }
        ${this.hasInteractiveElements ? this.pollGenerator.getPollCSS() : ''}

        ${this.css}

        /* Default Reveal.js overrides */
        .reveal {
            font-size: 32px; /* Reduced from default 40px */
        }

        .reveal .slides {
            text-align: left; /* Remove default centering */
        }

        .reveal h1 {
            font-size: 2em; /* Reduced from default 2.5em */
        }

        .reveal h2 {
            font-size: 1.3em; /* Reduced from default 1.8em */
        }

        .reveal h3 {
            font-size: 1em; /* Reduced from default 1.5em */
        }

        .reveal .slide-footnotes {
            margin-top: 1em;
            border-top: 1px solid currentColor;
            font-size: 0.55em;
            text-align: left;
        }

        .reveal .slide-footnotes ol {
            display: block;
            margin: 0.4em 0 0 1.5em;
        }

        .reveal .footnote-marker {
            font-size: 0.6em;
        }

        /* Reveal.js columns layout */
        .columns {
            display: flex;
            gap: 1em;
            align-items: flex-start;
        }

        .column {
            flex: 1;
        }

   ${this.useSyncFragments ? `
        /* Synchronized fragments styling */
        .sync-container {
            position: relative;
            min-height: 50px;
            font-size: 0.9em;
        }
        .sync-item {
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }
        .sync-item.active {
            display: block;
            opacity: 1;
        }
        .sync-item p {
            margin: 0.3em 0;
        }
        .sync-item img {
            max-width: 100%;
            height: auto;
        }
        /* Keep mode: stack items vertically */
        .sync-container[data-keep="true"] {
            display: flex;
            flex-direction: column;
            gap: 0.3em;
        }
        .sync-container[data-keep="true"] .sync-item {
            position: relative;
        }` : ''}
${this.ideRuntime.generateStyles()}
    </style>
</head>
<body>
    ${
        this.css
            ? `<header class="header-banner">
        <div class="header-author">${this.author}</div>
        ${
            this.logo
                ? `<img src="${ImageConverter.convertToBase64Sync(
                    this.logo, 
                    this.sourceFilePath ? path.dirname(this.sourceFilePath) : undefined
                )}" alt="Logo" class="header-logo">`
                : ''
        }
    </header>`
            : ''
    }
    <div class="reveal">
        <div class="slides">
${slidesContent}
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/reveal.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/plugin/highlight/highlight.js"></script>
    ${this.useLatex ? '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>' : ''}
    ${this.useLatex ? '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>' : ''}
    ${this.chalkboardEnabled ? chalkboardCDN.js : ''}
    ${this.ideRuntime.generateScriptTags()}
    ${this.ideRuntime.generateMonacoLoaderScript()}
    ${this.hasInteractiveElements ? `
    <!-- Chart.js for visualizations -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <!-- Socket.io (must be before Monaco) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.6.1/socket.io.js"></script>
    
    <!-- ResizeObserver polyfill for older browsers/mobile -->
    <script src="https://cdn.jsdelivr.net/npm/resize-observer-polyfill@1.5.1/dist/ResizeObserver.js"></script>
    
    <!-- Seminar plugin -->
    <script src="https://cdn.jsdelivr.net/npm/reveal.js-plugins@latest/seminar/plugin.js"></script>
    <!-- Poll plugin requires seminar plugin -->
    <script src="https://cdn.jsdelivr.net/npm/reveal.js-plugins@latest/poll/plugin.js"></script>
    ` : ''}
    <script>
        ${this.ideRuntime.generateMonacoEditorScript()}
        ${this.hasInteractiveElements ? `const originalUrl = window.location.href;
        const guestParam = new URL(originalUrl).searchParams.get('guest');
        ` : ''}
        const annotationLayers = [];
        const slidesContainer = document.querySelector('.reveal .slides');
        slidesContainer.querySelectorAll('section .sd-annotation-layer').forEach(layer => {
            const slide = layer.closest('section');
            const fragment = layer.closest('.fragment');
            if (!slide || !fragment) return;
            const scaleX = layer.style.getPropertyValue('--sd-annotation-scale-x');
            const scaleY = layer.style.getPropertyValue('--sd-annotation-scale-y');
            if (scaleX && scaleY) layer.style.scale = scaleX + ' ' + scaleY;
            layer.dataset.sdAnnotationSlide = slide.getAttribute('data-slide-index');
            annotationLayers.push({ layer, slide, fragment });
            layer.style.display = 'none';
            slidesContainer.appendChild(layer);
        });
        function updateAnnotationLayers() {
            const current = Reveal.getCurrentSlide();
            annotationLayers.forEach(({ layer, slide, fragment }) => {
                layer.style.display = slide === current && fragment.classList.contains('visible') ? 'block' : 'none';
            });
            document.dispatchEvent(new Event('sd-annotations-changed'));
        }
        window.sdUpdateAnnotationLayers = updateAnnotationLayers;
        Reveal.on('ready', updateAnnotationLayers);
        Reveal.on('slidechanged', updateAnnotationLayers);
        Reveal.on('fragmentshown', updateAnnotationLayers);
        Reveal.on('fragmenthidden', updateAnnotationLayers);
        const slideTransitions = new WeakMap();
        document.querySelectorAll('.reveal .slides > section').forEach(slide => {
            slideTransitions.set(slide, slide.getAttribute('data-transition'));
        });
        const defaultTransition = ${JSON.stringify(this.transition).replace(/</g, '\\u003c')};
        const transitionRuns = new WeakMap();
        Reveal.on('slidechanged', event => {
            if (!event.currentSlide || !event.previousSlide) return;
            const transition = slideTransitions.get(event.currentSlide) ?? defaultTransition;
            event.currentSlide.setAttribute('data-transition', transition);
            event.previousSlide.setAttribute('data-transition', transition);
            const previous = event.previousSlide;
            const run = {};
            transitionRuns.set(previous, run);
            const restore = () => {
                if (transitionRuns.get(previous) !== run || previous.classList.contains('present')) return;
                transitionRuns.delete(previous);
                const original = slideTransitions.get(previous);
                if (original === null) previous.removeAttribute('data-transition');
                else if (original !== undefined) previous.setAttribute('data-transition', original);
            };
            const onEnd = endEvent => {
                if (endEvent.target === previous) {
                    previous.removeEventListener('transitionend', onEnd);
                    restore();
                }
            };
            previous.addEventListener('transitionend', onEnd);
            setTimeout(() => {
                previous.removeEventListener('transitionend', onEnd);
                restore();
            }, 2000);
        });
        Reveal.initialize({
            hash: ${useUrlHash},
            transition: ${JSON.stringify(this.transition).replace(/</g, '\\u003c')},
            progress: true,
            slideNumber: 'c/t',
            center: true,
            backgroundTransition: 'fade',
            ${this.hasInteractiveElements ? `
            seminar: {
                server: window.location.protocol + '//' + window.location.hostname + ':4433',
                venue: 'slidedeckml',
                room: 'slidedeckml-room',
                hash: '$2a$05$hhgakVn1DWBfgfSwMihABeYToIBEiQGJ.ONa.HWEiNGNI6mxFCy8S',
                autoJoin: false
            },
            ` : ''}
            plugins: [ RevealHighlight${this.chalkboardEnabled ? ', RevealChalkboard, RevealCustomControls' : ''}${this.hasInteractiveElements ? ', RevealSeminar, RevealPoll' : ''} ]${this.chalkboardEnabled ? ',\n            chalkboard: ' + this.getChalkboardConfig() : ''}
        });${this.useLatex ? `

        // Auto-render LaTeX when slides are ready
        Reveal.on('ready', function() {
            renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        });` : ''}${this.hasInteractiveElements ? `

        if (guestParam === 'true') {
            Reveal.on('slidechanged', function() {
                const currentUrl = new URL(window.location.href);
                if (!currentUrl.searchParams.has('guest')) {
                    currentUrl.searchParams.set('guest', 'true');
                    window.history.replaceState({}, '', currentUrl.toString());
                }
            });
        }` : ''}${this.useSyncFragments ? `

        // Synchronized fragments handler
        let currentFragmentIndex = -1;

        Reveal.on('fragmentshown', event => {
            currentFragmentIndex++;
            updateSyncItems();
        });

        Reveal.on('fragmenthidden', event => {
            currentFragmentIndex--;
            updateSyncItems();
        });

        Reveal.on('slidechanged', event => {
            // Detect the current fragment state by checking visible fragments
            const currentSlide = Reveal.getCurrentSlide();
            if (currentSlide) {
                const fragments = currentSlide.querySelectorAll('.fragment');
                let maxVisibleIndex = -1;
                
                fragments.forEach(fragment => {
                    if (fragment.classList.contains('visible')) {
                        const fragmentIndex = parseInt(fragment.getAttribute('data-fragment-index') || '0');
                        maxVisibleIndex = Math.max(maxVisibleIndex, fragmentIndex);
                    }
                });
                
                currentFragmentIndex = maxVisibleIndex;
            } else {
                currentFragmentIndex = -1;
            }
            updateSyncItems();
        });

        function updateSyncItems() {
            const currentSlide = Reveal.getCurrentSlide();
            if (!currentSlide) return;

            const syncContainers = currentSlide.querySelectorAll('.sync-container');
            syncContainers.forEach(container => {
                const keepMode = container.getAttribute('data-keep') === 'true';
                const items = container.querySelectorAll('.sync-item');
                
                items.forEach(item => {
                    const syncIndex = parseInt(item.getAttribute('data-sync-index') || '0');
                    
                    if (keepMode) {
                        // In keep mode, show all items up to and including current index
                        if (syncIndex <= currentFragmentIndex) {
                            item.classList.add('active');
                        } else {
                            item.classList.remove('active');
                        }
                    } else {
                        // Default mode: show only the current item
                        if (syncIndex === currentFragmentIndex) {
                            item.classList.add('active');
                        } else {
                            item.classList.remove('active');
                        }
                    }
                });
            });
        }

        // Initialize on load
        Reveal.on('ready', () => {
            updateSyncItems();
        });` : ''}

        ${this.hasInteractiveElements ? this.pollGenerator.getPollJS() : ''}
    </script>
</body>
</html>`
    }
}