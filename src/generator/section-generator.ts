import { Block, Slide, isQuiz } from "../language/generated/ast";
import { LineContentHandler } from "./line-content-handler";
import { PollGenerator } from "./poll-generator";

/**
 * Handles the generation of HTML sections (slides)
 */
export class SectionGenerator {
    private lineContentHandler: LineContentHandler;
    private pollGenerator: PollGenerator;
    private currentSlideIndex = 0;

    constructor(lineContentHandler: LineContentHandler) {
        this.lineContentHandler = lineContentHandler;
        this.pollGenerator = new PollGenerator();
    }

    /**
     * Get the line content handler
     */
    public getLineContentHandler(): LineContentHandler {
        return this.lineContentHandler;
    }

    /**
     * Get the poll generator
     */
    public getPollGenerator(): PollGenerator {
        return this.pollGenerator;
    }

    /**
     * Generate HTML for a slide section
     * @param slide The slide to generate
     * @returns Generated HTML string
     */
    public async generateSection(slide: Slide): Promise<string> {
        const textProcessor = this.lineContentHandler.getElementGenerator().textProcessor;
        textProcessor.resetFootnotes();
        const blocks: string[] = [];
        for (const block of slide.blocks) blocks.push(await this.generateBlock(block));
        const footnotes = textProcessor.renderFootnotes();
        if (footnotes) blocks.push(footnotes);
        const contentHTML = blocks.join('\n');

        // Parse transition if specified
        let transitionAttr = '';
        if (slide.transition) {
            const transitionValue = this.parseTransition(slide.transition);
            if (transitionValue) {
                transitionAttr = ` data-transition="${transitionValue}"`;
            }
        }

        return `        <section data-slide-index="${this.currentSlideIndex}"${transitionAttr}>\n${contentHTML}\n        </section>`;
    }

    /**
     * Parse transition attribute
     * @param transitionStr Transition string like {transition: "slide"} or {transition: "slide-in fade-out"}
     * @returns Parsed transition value
     */
    private parseTransition(transitionStr: string): string {
        const match = transitionStr.match(/\{transition:\s*["']([^"']+)["']\}/);
        return match ? match[1] : '';
    }

    /**
     * Generate HTML for a block
     * @param block The block to generate
     * @returns Generated HTML string
     */
    private async generateBlock(block: Block): Promise<string> {
        let html = '';

        // Handle Quiz blocks
        if (isQuiz(block)) {
            html += this.pollGenerator.generateQuiz(block);
        }
        // Handle regular content blocks
        else if (block.lines.length > 0) {
            const lines: string[] = [];
            for (const line of block.lines) lines.push(await this.lineContentHandler.generateLine(line));
            html += lines.join('\n');
        }

        return html;
    }

    /**
     * Increment the slide index counter
     */
    public incrementSlideIndex(): void {
        this.currentSlideIndex++;
    }

    /**
     * Reset the slide index counter
     */
    public resetSlideIndex(): void {
        this.currentSlideIndex = 0;
    }

    /**
     * Get the current slide index
     */
    public getCurrentSlideIndex(): number {
        return this.currentSlideIndex;
    }
}
