import { ImageConverter } from "./image-converter";
import { VideoAssetManager } from "./video-asset-manager";
import { StyleParser } from "./style-parser";
import { isRootCstNode } from "langium";
import { List, Media, NestedStyledElement, StyledElement, OrderedListItem, UnorderedListItem, isOrderedListItem } from "../language/generated/ast";
import { getImageOffset } from "./image-position";
import { getBlockOffset } from "./block-position";
import * as path from 'path';

interface NestedListItem {
    item: OrderedListItem | UnorderedListItem;
    indentation: number;
    contentColumn: number;
    children: NestedListItem[];
}

function qrCodeHtml(data: string, style: string = ''): string {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
    return `<img src="${qrUrl}" alt="QR Code"${style} class="qr-code-standalone">`;
}

/**
 * This module is responsible for generating HTML elements from the AST nodes.
 * So Each lines is a specific element (heading, paragraph, list, etc.)
 * And for each text inside an element we use the TextProcessor to handle inline formatting. (bold, italic, underline) 
 */
export class ElementGenerator {
    textProcessor = new TextProcessor();
    private sourceFilePath?: string;
    private videoAssetManager = new VideoAssetManager();
    private previewImagePositions = false;
    private imageMappings: Array<{ start: number; end: number; content: string }> = [];
    private blockMappings: Array<{ start: number; end: number; content: string; style?: string }> = [];

    public enablePreviewImagePositions(): void {
        this.previewImagePositions = true;
    }

    public getImageMappings(): Array<{ start: number; end: number; content: string }> {
        return this.imageMappings;
    }

    public getBlockMappings(): Array<{ start: number; end: number; content: string; style?: string }> {
        return this.blockMappings;
    }

    public getBlockPreviewAttributes(block: StyledElement | NestedStyledElement): string {
        const cst = block.$cstNode;
        const offset = getBlockOffset(block.style);
        if (!this.previewImagePositions || !cst || !offset) return '';
        this.blockMappings.push({ start: cst.offset, end: cst.end, content: cst.text, style: block.style });
        return ` data-sd-block="${cst.offset}" data-sd-x="${offset.x}" data-sd-y="${offset.y}"`;
    }
    /**
     * Set the source file path for resolving relative image paths
     * @param filePath Absolute path to the .sdml file
     */
    public setSourceFilePath(filePath: string): void {
        this.sourceFilePath = filePath;
        this.videoAssetManager.setSourceFilePath(filePath);
    }

    /**
     * Set the output HTML file path for video asset management
     * @param htmlPath Absolute path to the output HTML file
     */
    public setOutputHtmlPath(htmlPath: string): void {
        this.videoAssetManager.setOutputHtmlPath(htmlPath);
    }

    /**
     * Generate a heading element
     * @param heading The heading AST node
     * @returns The HTML string for the heading
     */
    public generateHeading(heading: any, style: string = ''): string {
        // Access level and text directly from the AST
        const level = heading.level.length;
        const text = heading.text;
        
        return `            <h${level}${style}>${this.textProcessor.processInlineText(text)}</h${level}>`;
    }

    /**
     * Generate a paragraph element
     * @param paragraph The paragraph AST node
     * @returns The HTML string for the paragraph
     */
    public generateParagraph(paragraph: any, style: string = ''): string {
        return `            <p${style}>${this.textProcessor.processInlineText(paragraph.text)}</p>`;
    }

    /**
     * Generate nested ordered and unordered lists
     * @param list The pointed list AST node
     * @returns The HTML string for the pointed list
     */
    public generateList(list: List): string {
        const cst = list.$cstNode;
        if (!cst || !isRootCstNode(cst.root)) {
            throw new Error('Cannot generate a list without source positions');
        }
        const lines = cst.root.fullText.split(/\r?\n/);
        const roots: NestedListItem[] = [];
        const stack: NestedListItem[] = [];
        for (const item of list.items) {
            if (!item.$cstNode) throw new Error('Cannot generate a list item without a source position');
            const line = lines[item.$cstNode.range.start.line];
            const match = /^([ \t]*)(?:[-+*]|\d+\.)([ \t]+)/.exec(line);
            if (!match) throw new Error(`Invalid list item at line ${item.$cstNode.range.start.line + 1}`);
            const indentation = this.listColumn(match[1]);
            const contentColumn = this.listColumn(match[0]);
            const node: NestedListItem = {item, indentation, contentColumn, children: []};
            while (stack.length > 0 && indentation < stack[stack.length - 1].contentColumn) {
                stack.pop();
            }
            if (stack.length > 0) {
                stack[stack.length - 1].children.push(node);
            } else {
                roots.push(node);
            }
            stack.push(node);
        }
        return this.renderListItems(roots, 12);
    }

    private listColumn(text: string): number {
        let column = 0;
        for (const char of text) column += char === '\t' ? 4 - column % 4 : 1;
        return column;
    }

    private renderListItems(items: NestedListItem[], indent: number): string {
        const lines: string[] = [];
        let index = 0;
        const prefix = ' '.repeat(indent);
        while (index < items.length) {
            const first = items[index].item;
            const ordered = isOrderedListItem(first);
            const tag = ordered ? 'ol' : 'ul';
            const start = isOrderedListItem(first) && first.number !== 1 ? ` start="${first.number}"` : '';
            lines.push(`${prefix}<${tag}${start}>`);
            while (index < items.length && isOrderedListItem(items[index].item) === ordered) {
                const node = items[index++];
                const text = this.textProcessor.processInlineText(node.item.text);
                if (node.children.length) {
                    lines.push(`${prefix}    <li>${text}`);
                    lines.push(this.renderListItems(node.children, indent + 8));
                    lines.push(`${prefix}    </li>`);
                } else {
                    lines.push(`${prefix}    <li>${text}</li>`);
                }
            }
            lines.push(`${prefix}</${tag}>`);
        }
        return lines.join('\n');
    }

    /**
     * Generate a quote element
     * @param quote The quote AST node
     * @returns The HTML string for the quote
     */
    public generateQuote(quote: any, style: string = ''): string {
        const text = quote.text;
        return `            <blockquote${style}>${this.textProcessor.processInlineText(text)}</blockquote>`;
    }

    /**
     * Generate a media element (image, video, or YouTube embed)
     * @param media The media AST node
     * @returns The HTML string for the media
     */
    public async generateMedia(media: Media, style: string = ''): Promise<string> {
        const content = media.content;
        
        // Parse the media line: ![alt](url)
        const match = content.match(/!\[([^\]]+)\]\(([^\)]+)\)/);
        if (!match) return '';
        
        const alt = match[1];
        const url = match[2];
        
        // Check if it's a YouTube link
        const youtubeVideoId = this.extractYouTubeVideoId(url);
        if (youtubeVideoId) {
            return `            <iframe${style} width="560" height="315" src="https://www.youtube.com/embed/${youtubeVideoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        }
        
        // Determine if it's a video based on file extension
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
        const isVideo = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
        
        if (isVideo) {
            // Process video path - copy to assets folder if local file
            const processedVideoUrl = await this.videoAssetManager.processVideoPath(url);
            return `            <video controls${style}>\n                <source src="${processedVideoUrl}" type="video/${this.getVideoType(url)}">\n                ${alt}\n            </video>`;
        } else {
            // Convert image to base64
            const basePath = this.sourceFilePath ? path.dirname(this.sourceFilePath) : undefined;
            const base64Url = await ImageConverter.convertToBase64Async(url, basePath);
            
            const offset = getImageOffset(content);
            if (offset.x !== 0 || offset.y !== 0) {
                const translate = `translate: ${offset.x}px ${offset.y}px`;
                style = style ? style.replace(/"$/, `; ${translate}"`) : ` style="${translate}"`;
            }
            let source = '';
            if (this.previewImagePositions && media.$cstNode) {
                const { offset: start, end } = media.$cstNode;
                this.imageMappings.push({ start, end, content });
                source = ` data-sd-image="${start}" data-sd-x="${offset.x}" data-sd-y="${offset.y}"`;
            }
            return `            <img src="${base64Url}" alt="${this.textProcessor.escapeHtml(alt)}"${style}${source}>`;
        }
    }

    /**
     * Extract YouTube video ID from various YouTube URL formats
     * @param url The YouTube URL
     * @returns The video ID or null if not a YouTube URL
     */
    private extractYouTubeVideoId(url: string): string | null {
        // Handle youtube.com/watch?v=VIDEO_ID
        let match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
        
        // Handle youtu.be/VIDEO_ID
        match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
        
        // Handle youtube.com/embed/VIDEO_ID
        match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
        
        // Handle youtube.com/v/VIDEO_ID
        match = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
        if (match) return match[1];
        
        return null;
    }

        /**
     * Generate a code block element
     * @param codeBlock The code block AST node
     * @returns The HTML string for the code block
     */
    public generateCodeBlock(codeBlock: any, style: string = ''): string {
        const content = codeBlock.content;
        
        // Parse the code block: ```language [attributes] code ```
        const match = content.match(/```([a-zA-Z0-9_\-]*)?(?:\s*\[([^\]]*)\])?\s*[\r\n]([\s\S]*?)```/);
        if (!match) return '';
        
        const language = match[1] || '';
        const attributesStr = match[2] || '';
        const code = match[3] || '';

        if (language.toLowerCase() === 'latex') {
            return this.generateLatexBlock(code.trim(), style)
        }

        // Build the class attribute
        const languageClass = language ? ` class="language-${language}"` : '';

        // Build data attributes for line numbers
        let dataAttrs = ' data-trim data-noescape';
        
        if (attributesStr) {
            // Parse attributes
            const attributes = this.parseCodeAttributes(attributesStr);
            
            // Handle abstract highlight modes
            if (attributes.highlight) {
                const highlightPattern = this.convertHighlightMode(attributes.highlight, code);
                if (highlightPattern) {
                    dataAttrs += ` data-line-numbers="${highlightPattern}"`;
                }
            }
            
            // Handle explicit line numbers (reveal.js style)
            if (attributes.lines) {
                dataAttrs += ` data-line-numbers="${attributes.lines}"`;
            }
            
            // Handle start offset
            if (attributes.start) {
                dataAttrs += ` data-line-numbers data-ln-start-from="${attributes.start}"`;
            }
        }

        // Escape HTML in code content
        const escapedCode = this.textProcessor.escapeHtml(code);

        return `            <pre${style}><code${languageClass}${dataAttrs}>${escapedCode}</code></pre>`;
    }
    /**
    * Generate a LaTeX block element for mathematical equations
    * @param latexCode The LaTeX equation code
    * @param style Optional style attributes
    * @returns The HTML string for the LaTeX block
    */

    private generateLatexBlock(latexCode: string, style: string = ''): string {
        return `            <div class="latex-block"${style}>\n                $$${latexCode}$$\n            </div>`;
    }


    /**
     * Parse code block attributes from string
     * Supports: highlight:block lines:'1-5' start:10
     * @param attributesStr The attributes string from the code block
     * @returns Parsed attributes object
     */
    private parseCodeAttributes(attributesStr: string): any {
        const attrs: any = {};
        
        // Match highlight mode: highlight:mode
        const highlightMatch = attributesStr.match(/highlight\s*:\s*([a-z\-]+)/);
        if (highlightMatch) {
            attrs.highlight = highlightMatch[1];
        }
        
        // Match lines: lines:'...' or lines:"..."
        const linesMatch = attributesStr.match(/lines\s*:\s*["']([^"']+)["']/);
        if (linesMatch) {
            attrs.lines = linesMatch[1];
        }
        
        // Match start: start:number
        const startMatch = attributesStr.match(/start\s*:\s*(\d+)/);
        if (startMatch) {
            attrs.start = startMatch[1];
        }
        
        return attrs;
    }

    /**
     * Convert abstract highlight mode to reveal.js line numbers pattern
     * @param mode The highlight mode keyword
     * @param code The code content
     * @returns The reveal.js line numbers pattern
     */
    private convertHighlightMode(mode: string, code: string): string {
        const lines = code.trim().split('\n');
        const totalLines = lines.length;

        switch (mode) {
            case 'all':
                return `1-${totalLines}`;
            
            case 'none':
                return '';
            
            case 'line-by-line':
                // Progressive highlighting: 1|2|3|4...
                return Array.from({length: totalLines}, (_, i) => i + 1).join('|');
            
            case 'block':
                // Highlight code blocks separated by empty lines
                return this.detectBlocks(lines);
            
            case 'function':
                // Detect function boundaries (heuristic)
                return this.detectFunctions(lines);
            
            case 'class':
                // Detect class boundaries (heuristic)
                return this.detectClasses(lines);
            
            default:
                return '';
        }
    }

    /**
     * Detect code blocks separated by empty lines
     * @param lines Array of code lines
     * @returns Reveal.js line pattern
     */
    private detectBlocks(lines: string[]): string {
        const blocks: string[] = [];
        let blockStart = 1;
        let inBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.length > 0) {
                if (!inBlock) {
                    blockStart = i + 1;
                    inBlock = true;
                }
            } else if (inBlock) {
                // Empty line marks end of block
                blocks.push(blockStart === i ? `${blockStart}` : `${blockStart}-${i}`);
                inBlock = false;
            }
        }
        
        // Handle last block
        if (inBlock) {
            blocks.push(blockStart === lines.length ? `${blockStart}` : `${blockStart}-${lines.length}`);
        }
        
        return blocks.join('|');
    }

    /**
     * Detect function boundaries (simple heuristic)
     * @param lines Array of code lines
     * @returns Reveal.js line pattern
     */
    private detectFunctions(lines: string[]): string {
        const functions: string[] = [];
        let funcStart = -1;
        let braceCount = 0;
        let baseIndent = -1;
        let usesBraces = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Detect function start (simple heuristic for common languages)
            if (funcStart === -1 && (
                /^(function|def|fn|func|public|private|protected|static)/.test(trimmedLine) ||
                /\bfunction\b/.test(trimmedLine) ||
                /^[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*\)\s*\{/.test(trimmedLine) ||
                /^(async\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*\)\s*(=>|:)/.test(trimmedLine)
            )) {
                funcStart = i + 1;
                baseIndent = line.length - line.trimStart().length;
                usesBraces = /\{/.test(trimmedLine);
            }
            
            if (funcStart !== -1) {
                if (usesBraces) {
                    // Brace-based languages (JavaScript, Java, C++, etc.)
                    braceCount += (trimmedLine.match(/\{/g) || []).length;
                    braceCount -= (trimmedLine.match(/\}/g) || []).length;
                    
                    if (braceCount === 0 && /\}/.test(trimmedLine)) {
                        functions.push(funcStart === i + 1 ? `${funcStart}` : `${funcStart}-${i + 1}`);
                        funcStart = -1;
                        baseIndent = -1;
                    }
                } else {
                    // Indentation-based languages (Python, etc.)
                    const currentIndent = line.length - line.trimStart().length;
                    
                    // Function ends when we encounter a line with same or less indentation (and it's not empty)
                    if (trimmedLine.length > 0 && currentIndent <= baseIndent && i > funcStart - 1) {
                        functions.push(funcStart === i ? `${funcStart}` : `${funcStart}-${i}`);
                        funcStart = -1;
                        baseIndent = -1;
                        
                        // Check if this line starts a new function
                        if (/^(def|async\s+def)\s+[a-zA-Z_]/.test(trimmedLine)) {
                            funcStart = i + 1;
                            baseIndent = currentIndent;
                        }
                    }
                }
            }
        }
        
        // Handle last function if file ends inside it
        if (funcStart !== -1) {
            functions.push(funcStart === lines.length ? `${funcStart}` : `${funcStart}-${lines.length}`);
        }
        
        return functions.join('|') || '1';
    }

    /**
     * Detect class boundaries (simple heuristic)
     * @param lines Array of code lines
     * @returns Reveal.js line pattern
     */
    private detectClasses(lines: string[]): string {
        const classes: string[] = [];
        let classStart = -1;
        let braceCount = 0;
        let baseIndent = -1;
        let usesBraces = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Detect class start
            if (classStart === -1 && /^(class|interface|struct|enum)\s+[a-zA-Z_]/.test(trimmedLine)) {
                classStart = i + 1;
                baseIndent = line.length - line.trimStart().length;
                usesBraces = /\{/.test(trimmedLine);
            }
            
            if (classStart !== -1) {
                if (usesBraces) {
                    // Brace-based languages (JavaScript, Java, C++, etc.)
                    braceCount += (trimmedLine.match(/\{/g) || []).length;
                    braceCount -= (trimmedLine.match(/\}/g) || []).length;
                    
                    if (braceCount === 0 && /\}/.test(trimmedLine)) {
                        classes.push(classStart === i + 1 ? `${classStart}` : `${classStart}-${i + 1}`);
                        classStart = -1;
                        baseIndent = -1;
                    }
                } else {
                    // Indentation-based languages (Python, etc.)
                    const currentIndent = line.length - line.trimStart().length;
                    
                    // Class ends when we encounter a line with same or less indentation (and it's not empty)
                    if (trimmedLine.length > 0 && currentIndent <= baseIndent && i > classStart - 1) {
                        classes.push(classStart === i ? `${classStart}` : `${classStart}-${i}`);
                        classStart = -1;
                        baseIndent = -1;
                        
                        // Check if this line starts a new class
                        if (/^class\s+[a-zA-Z_]/.test(trimmedLine)) {
                            classStart = i + 1;
                            baseIndent = currentIndent;
                            usesBraces = /\{/.test(trimmedLine);
                        }
                    }
                }
            }
        }
        
        // Handle last class if file ends inside it
        if (classStart !== -1) {
            classes.push(classStart === lines.length ? `${classStart}` : `${classStart}-${lines.length}`);
        }
        
        return classes.join('|') || '1';
    }

    /**
     * Generate synchronized fragments that appear with code highlighting
     * @param syncFragments The sync fragments AST node
     * @param lastCodeBlock The previous code block to sync with
     * @returns The HTML string for the synchronized fragments
     */
    public async generateSyncFragments(syncFragments: any, lastCodeBlock: any | null): Promise<string> {
        if (!syncFragments.fragments || syncFragments.fragments.length === 0) {
            return '';
        }

        // Check if keep mode is enabled (accumulate fragments instead of replacing)
        const keepMode = syncFragments.opening && syncFragments.opening.includes('keep');
        const keepAttr = keepMode ? ' data-keep="true"' : '';
        
        // Generate container div with custom classes
        let html = `            <div class="sync-container"${keepAttr}>`;
        
        for (let index = 0; index < syncFragments.fragments.length; index++) {
            const fragment = syncFragments.fragments[index];
            let content = '';
            
            // Check if it's media or text
            if (fragment.media) {
                // Parse media line: ![alt](url)
                const match = fragment.media.match(/!\[([^\]]*)\]\(([^\)]+)\)/);
                if (match) {
                    const alt = match[1] || '';
                    const url = match[2];
                    
                    // Convert image to base64
                    const basePath = this.sourceFilePath ? path.dirname(this.sourceFilePath) : undefined;
                    const base64Url = await ImageConverter.convertToBase64Async(url, basePath);
                    
                    const offset = getImageOffset(fragment.media);
                    const translate = offset.x || offset.y ? ` translate: ${offset.x}px ${offset.y}px;` : '';
                    content = `<img src="${base64Url}" alt="${this.textProcessor.escapeHtml(alt)}" style="max-width: 100%; height: auto;${translate}" />`;
                }
            } else if (fragment.text) {
                // Process text with inline formatting
                content = `<p>${this.textProcessor.processInlineText(fragment.text)}</p>`;
            }
            
            // Add sync item with data-sync-index matching code highlight step
            html += `\n                <div class="sync-item" data-sync-index="${index - 1}">${content}</div>`;
        }
        
        html += '\n            </div>';
        return html;
    }

    /**
     * Generate a QR code element
     * @param qrCode The QR code AST node
     * @returns The HTML string for the QR code
     */
    public generateQrCode(qrCode: any, style: string = ''): string {
        const data = qrCode.data.replace(/^"|"$/g, ''); // Remove quotes
        return `            ${qrCodeHtml(data, style)}`;
    }

    /**
     * Get video MIME type from file extension
     * @param url The video URL
     * @returns The MIME type
     */
    private getVideoType(url: string): string {
        if (url.toLowerCase().endsWith('.webm')) return 'webm';
        if (url.toLowerCase().endsWith('.ogg')) return 'ogg';
        if (url.toLowerCase().endsWith('.mov')) return 'quicktime';
        return 'mp4'; // default
    }
}

/**
 * This class is responsible for processing inline text formatting.
 * It handles bold, italic, and underline formatting.
 */
export class TextProcessor {
    private styleParser = new StyleParser();
    private footnotes: {text: string, classes: string[], styles: string[], note?: string}[] = [];

    public resetFootnotes(): void {
        this.footnotes = [];
    }

    public renderFootnotes(): string {
        if (!this.footnotes.length) return '';
        const items = this.footnotes.map(note => {
            const classes = note.classes.length ? ` class="${this.escapeHtml(note.classes.join(' '))}"` : '';
            const styles = note.styles.length ? ` style="${this.escapeHtml(note.styles.join('; '))}"` : '';
            const title = note.note !== undefined ? ` title="${this.escapeHtml(note.note)}" data-sd-note` : '';
            const text = this.escapeHtml(note.text);
            return `                <li>${classes || styles || title ? `<span${classes}${styles}${title}>${text}</span>` : text}</li>`;
        }).join('\n');
        return `            <aside class="slide-footnotes" aria-label="Footnotes">\n                <ol>\n${items}\n                </ol>\n            </aside>`;
    }

    public processInlineText(text: string): string {
        const replacements: string[] = [];
        let marker = '\u0000';
        while (text.includes(marker)) marker += '\u0000';
        const protect = (html: string): string => {
            const token = `${marker}${replacements.length}${marker}`;
            replacements.push(html);
            return token;
        };
        let source = '';
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\\' && i + 1 < text.length && '[]{}\\'.includes(text[i + 1])) {
                source += protect(this.escapeHtml(text[++i]));
                continue;
            }
            if (text[i] === '!' && text[i + 1] === '[') {
                const link = /^!\[([^\[\]\r\n]+)\][ \t]+"([^"\r\n]*)"/.exec(text.slice(i));
                if (link) {
                    if (link[1] === 'QR') {
                        source += protect(qrCodeHtml(link[2]));
                    } else {
                        const url = link[2];
                        if (!url || /[\u0000-\u0020\u007f\\]/.test(url) ||
                            (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) && !/^(?:https?|mailto):/i.test(url))) {
                            throw new Error(`Invalid hyperlink destination: ${url}`);
                        }
                        source += protect(`<a href="${this.escapeHtml(url)}">${this.processInlineText(link[1])}</a>`);
                    }
                    i += link[0].length - 1;
                    continue;
                }
            }
            if (text[i] === '[') {
                const span = this.findInlineSpan(text, i);
                if (span) {
                    const attributes = this.styleParser.parseInlineAttributes(span.attributes);
                    if (attributes) {
                        const classes = attributes.classes.length
                            ? ` class="${this.escapeHtml(attributes.classes.join(' '))}"`
                            : '';
                        const styles = attributes.styles.length
                            ? ` style="${this.escapeHtml(attributes.styles.join('; '))}"`
                            : '';
                        const note = attributes.note !== undefined
                            ? ` title="${this.escapeHtml(attributes.note)}" data-sd-note`
                            : '';
                        const content = this.processInlineText(span.content);
                        let marker = '';
                        if (attributes.footnote !== undefined) {
                            this.footnotes.push(attributes.footnote);
                            marker = `<sup class="footnote-marker">[${this.footnotes.length}]</sup>`;
                        }
                        source += protect(`<span${classes}${styles}${note}>${content}</span>${marker}`);
                        i = span.end;
                        continue;
                    }
                    if (/\bfootnote\s*:\s*\[/.test(span.attributes)) {
                        source += protect(this.escapeHtml(text.slice(i, span.end + 1)));
                        i = span.end;
                        continue;
                    }
                }
            }
            source += text[i];
        }

        let result = this.escapeHtml(source);
        // Process bold (**text**)
        result = this.processBold(result);
        // Process underline (__text__)
        result = this.processUnderline(result);
        // Process italic (*text* or _text_)
        result = this.processItalic(result);
        for (let i = 0; i < replacements.length; i++) {
            result = result.split(`${marker}${i}${marker}`).join(replacements[i]);
        }
        return result;
    }

    private findInlineSpan(text: string, start: number): {content: string, attributes: string, end: number} | undefined {
        let depth = 1;
        let close = start + 1;
        for (; close < text.length; close++) {
            if (text[close] === '\\' && close + 1 < text.length) {
                close++;
            } else if (text[close] === '[') {
                depth++;
            } else if (text[close] === ']' && --depth === 0) {
                break;
            }
        }
        if (depth !== 0 || text[close + 1] !== '{') return undefined;

        let quote = '';
        let braceDepth = 0;
        for (let end = close + 2; end < text.length; end++) {
            const char = text[end];
            if (quote && char === '\\' && end + 1 < text.length) {
                end++;
            } else if (quote && char === quote) {
                quote = '';
            } else if (!quote && (char === "'" || char === '"')) {
                quote = char;
            } else if (!quote && char === '{') {
                braceDepth++;
            } else if (!quote && char === '}' && braceDepth > 0) {
                braceDepth--;
            } else if (!quote && char === '}') {
                return {
                    content: text.slice(start + 1, close),
                    attributes: text.slice(close + 2, end),
                    end
                };
            }
        }
        return undefined;
    }

    /**
     * Found a bold pattern in the text and replace it with <strong> tags
     * @param text The text to process
     * @returns The processed text
     */
    private processBold(text: string): string {
        // Match ** but not *** (which would be bold+italic)
        return text.replace(/\*\*(?!\*)(.+?)(?<!\*)\*\*/g, '<strong>$1</strong>');
    }

    /**
     * Found an italic pattern in the text and replace it with <em> tags
     * Supports both *text* and _text_ syntax
     * @param text The text to process
     * @returns The processed text
     */
    private processItalic(text: string): string {
        // Process *italic* but not ** (bold) or <strong>*text*</strong>
        let result = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        // Process _italic_ but not __ (underline)
        result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
        return result;
    }

    /**
     * Found an underline pattern in the text and replace it with <u> tags
     * @param text The text to process
     * @returns The processed text
     */
    private processUnderline(text: string): string {
        return text.replace(/__(.+?)__/g, '<u>$1</u>');
    }

    /**
     * Escape HTML entities in the text
     * @param text The text to escape
     * @returns The escaped text
     */
    public escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}