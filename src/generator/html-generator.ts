import { Presentation, isCodeBlock, isSyncFragments, isStyledElement, isNestedStyledElement, isFragmentElement, LineContent, Editor, Output } from "../language/generated/ast";
import { ElementGenerator } from "./element-generator";
import { TemplateGenerator } from "./template";
import { StyleParser } from "./style-parser";
import { LineContentHandler } from "./line-content-handler";
import { SectionGenerator } from "./section-generator";
import { InteractiveElementDetector } from "./interactive-element-detector";
import { IdeRuntimeGenerator } from "./ide-runtime";

export interface HtmlGenerationOptions {
    useUrlHash?: boolean;
    previewImagePositions?: boolean;
}

/**
 * Main HTML generator that orchestrates the conversion of SlideDeck to HTML
 */
export class HtmlGenerator {
    private templateGenerator: TemplateGenerator;
    private sectionGenerator: SectionGenerator;
    private ideRuntime: IdeRuntimeGenerator;

    constructor() {
        // Initialize the dependency chain
        this.ideRuntime = new IdeRuntimeGenerator();
        const elementGenerator = new ElementGenerator();
        const styleParser = new StyleParser();
        const lineContentHandler = new LineContentHandler(elementGenerator, styleParser, this.ideRuntime);
        this.sectionGenerator = new SectionGenerator(lineContentHandler);
        this.templateGenerator = new TemplateGenerator(this.sectionGenerator.getPollGenerator(), this.ideRuntime);
    }

    /**
     * Generate complete HTML presentation from SlideDeck AST
     * @param presentation The presentation AST
     * @param sourceFilePath Absolute path to the source .sdml file (for resolving relative image paths)
     * @param outputHtmlPath Absolute path to the output HTML file (for managing video assets)
     * @param options HTML generation options
     * @returns Complete HTML document string
     */
    public async generateHTML(presentation: Presentation, sourceFilePath?: string, outputHtmlPath?: string, options?: HtmlGenerationOptions): Promise<string> {
        if (options?.previewImagePositions) {
            this.sectionGenerator.getLineContentHandler().getElementGenerator().enablePreviewImagePositions();
        }
        if (presentation.metadata) {
            this.templateGenerator.setMetadata(presentation.metadata);
        }

        // Set source file path for image resolution
        if (sourceFilePath) {
            this.templateGenerator.setSourceFilePath(sourceFilePath);
            this.setSourceFilePath(sourceFilePath);
        }

        // Set output HTML path for video asset management
        if (outputHtmlPath) {
            this.setOutputHtmlPath(outputHtmlPath);
        }

        // Detect feature usage in the presentation
        this.detectFeatureUsage(presentation);

        // Check if presentation has interactive elements (quiz/poll)
        const hasInteractive = InteractiveElementDetector.hasInteractiveElements(presentation);
        this.templateGenerator.setHasInteractiveElements(hasInteractive);

        // Reset slide index counter
        this.sectionGenerator.resetSlideIndex();

        // Generate slides with index tracking
        const slides: string[] = [];
        for (const slide of presentation.slides?.slides || []) {
            slides.push(await this.sectionGenerator.generateSection(slide));
            this.sectionGenerator.incrementSlideIndex();
        }
        
        const slidesHTML = slides.join("\n");

        return this.templateGenerator.getHTMLTemplate(slidesHTML, options?.useUrlHash);
    }

    public getImageMappings(): Array<{ start: number; end: number; content: string }> {
        return this.sectionGenerator.getLineContentHandler().getElementGenerator().getImageMappings();
    }

    public getBlockMappings(): Array<{ start: number; end: number; content: string; style?: string }> {
        return this.sectionGenerator.getLineContentHandler().getElementGenerator().getBlockMappings();
    }

    /**
     * Detect which features are used in the presentation and enable them in the template
     * @param presentation The presentation AST
     */
    private detectFeatureUsage(presentation: Presentation): void {
        const slides = presentation.slides?.slides || [];
        
        for (const slide of slides) {
            for (const block of slide.blocks) {
                for (const line of block.lines) {
                    this.checkLineForFeatures(line);
                }
            }
        }
    }

    /**
     * Recursively check a line and its nested elements for feature usage
     * @param line The line content to check
     */
    private checkLineForFeatures(line: LineContent | Editor | Output): void {
        // Check for LaTeX code blocks
        if (isCodeBlock(line)) {
            if (line.content.match(/```latex/i)) {
                this.templateGenerator.enableLatex();
            }
        }
        
        // Check for synchronized fragments
        if (isSyncFragments(line)) {
            this.templateGenerator.enableSyncFragments();
        }
        
        // Recursively check styled elements
        if (isStyledElement(line) || isNestedStyledElement(line)) {
            for (const element of line.elements) {
                this.checkLineForFeatures(element);
            }
        }
        
        // Recursively check fragment elements
        if (isFragmentElement(line)) {
            for (const element of line.elements) {
                this.checkLineForFeatures(element);
            }
        }
    }

    /**
     * Set the source file path for resolving relative image paths
     * @param sourceFilePath Absolute path to the source .sdml file
     */
    private setSourceFilePath(sourceFilePath: string): void {
        const lineContentHandler = this.sectionGenerator.getLineContentHandler();
        const elementGenerator = lineContentHandler.getElementGenerator();
        elementGenerator.setSourceFilePath(sourceFilePath);
    }

    /**
     * Set the output HTML file path for video asset management
     * @param outputHtmlPath Absolute path to the output HTML file
     */
    private setOutputHtmlPath(outputHtmlPath: string): void {
        const lineContentHandler = this.sectionGenerator.getLineContentHandler();
        const elementGenerator = lineContentHandler.getElementGenerator();
        elementGenerator.setOutputHtmlPath(outputHtmlPath);
    }
}
