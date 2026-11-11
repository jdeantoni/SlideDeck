import type { Presentation } from '../language/generated/ast';
import { HtmlGenerationOptions, HtmlGenerator } from '../generator/html-generator';
import { createSlideDeckServices } from "../language/slide-deck-module";
import { NodeFileSystem } from "langium/node";
import { URI } from "vscode-uri";
import * as path from 'path';

export interface CompilationResult {
    html: string;
    slideCount: number;
    error?: string;
    slideIndex?: number;
    slideStartLines?: number[];
    hasTemplate?: boolean;
}

export interface SlideMapping {
    slideIndex: number;
    startLine: number;
    endLine: number;
}

export class CompilerService {
    private services = createSlideDeckServices(NodeFileSystem).SlideDeck;

    /**
     * Compile SDML content to HTML
     * @param content SDML content
     * @param cursorLine Optional cursor line to determine which slide to display
     * @param sourceFilePath Optional source file path for resolving relative paths (e.g., logos)
     * @param options HTML generation options
     * @param outputHtmlPath Optional output path for generated assets
     * @returns Compilation result with HTML and metadata
     */
    async compile(content: string, cursorLine?: number, sourceFilePath?: string, options?: HtmlGenerationOptions, outputHtmlPath?: string): Promise<CompilationResult> {
        try {
            // Parse the document
            const document = this.services.shared.workspace.LangiumDocumentFactory.fromString(
                content,
                URI.file('memory://temp.sdml')
            );

            // Build the document (validate and link)
            await this.services.shared.workspace.DocumentBuilder.build([document], {
                validationChecks: 'all'
            });

            // Check for lexer errors
            if (document.parseResult.lexerErrors.length > 0) {
                const errors = document.parseResult.lexerErrors
                    .map(e => `Line ${e.line}: ${e.message}`)
                    .join('\n');
                return {
                    html: '',
                    slideCount: 0,
                    error: `Lexer errors:\n${errors}`
                };
            }

            // Check for parser errors
            if (document.parseResult.parserErrors.length > 0) {
                const errors = document.parseResult.parserErrors
                    .map(e => `Line ${e.token.startLine}: ${e.message}`)
                    .join('\n');
                return {
                    html: '',
                    slideCount: 0,
                    error: `Parser errors:\n${errors}`
                };
            }

            // Extract AST
            const presentation = document.parseResult.value as Presentation;

            // Generate HTML
            const html = await new HtmlGenerator().generateHTML(
                presentation,
                sourceFilePath ? path.resolve(sourceFilePath) : undefined,
                outputHtmlPath ? path.resolve(outputHtmlPath) : undefined,
                options
            );

            // Calculate slide count
            const slideCount = presentation.slides?.slides?.length || 0;

            // Determine which slide to display based on cursor position
            let slideIndex: number | undefined;
            if (cursorLine !== undefined) {
                slideIndex = this.getSlideIndexFromLine(content, cursorLine);
            }

            return {
                html,
                slideCount,
                slideIndex,
                slideStartLines: (presentation.slides?.slides || []).map(slide => slide.$cstNode?.range.start.line ?? 0)
            };

        } catch (error) {
            return {
                html: '',
                slideCount: 0,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get the slide index for a given line number
     * @param content SDML content
     * @param lineNumber Line number (0-based)
     * @returns Slide index (0-based, not counting template)
     */
    getSlideIndexFromLine(content: string, lineNumber: number): number {
        const lines = content.split('\n');
        const slideMappings = this.buildSlideMappings(lines);

        // Find which slide contains this line
        for (const mapping of slideMappings) {
            if (lineNumber >= mapping.startLine && lineNumber <= mapping.endLine) {
                return mapping.slideIndex;
            }
        }

        // Default to first slide if not found
        return 0;
    }

    /**
     * Build mappings of line ranges to slide indices
     * @param lines Array of content lines
     * @returns Array of slide mappings
     */
    private buildSlideMappings(lines: string[]): SlideMapping[] {
        const mappings: SlideMapping[] = [];
        let currentSlideIndex = 0;
        let currentSlideStart = -1;
        let inMetadata = false;
        let inTemplate = false;
        let firstTemplateSeparator = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detect metadata block (starts with { at line 0)
            if (i === 0 && line.startsWith('{')) {
                inMetadata = true;
                continue;
            }

            // End of metadata
            if (inMetadata && line.startsWith('}')) {
                inMetadata = false;
                continue;
            }

            // Skip lines inside metadata
            if (inMetadata) {
                continue;
            }

            // Detect template separator (---)
            if (line === '---') {
                if (firstTemplateSeparator === -1) {
                    // First --- encountered - start of template
                    firstTemplateSeparator = i;
                    inTemplate = true;
                } else {
                    // Second --- encountered - end of template
                    inTemplate = false;
                }
                continue;
            }

            // Detect first slide separator after template
            // This means template had only one separator and ends here
            if (inTemplate && line === '===') {
                inTemplate = false;
                // Don't process this === yet, it will be processed in next iteration
            }

            // Skip lines inside template
            if (inTemplate) {
                continue;
            }

            // Initialize slide start if not set
            if (currentSlideStart === -1 && line !== '' && line !== '===') {
                currentSlideStart = i;
            }

            // Detect slide separator (===)
            if (line === '===') {
                if (currentSlideStart !== -1) {
                    // End current slide
                    mappings.push({
                        slideIndex: currentSlideIndex,
                        startLine: currentSlideStart,
                        endLine: i - 1
                    });
                    currentSlideIndex++;
                    currentSlideStart = -1; // Reset for next slide
                }
            }
        }

        // Add the last slide if there's content
        if (currentSlideStart !== -1 && currentSlideStart < lines.length) {
            mappings.push({
                slideIndex: currentSlideIndex,
                startLine: currentSlideStart,
                endLine: lines.length - 1
            });
        }

        return mappings;
    }
}
