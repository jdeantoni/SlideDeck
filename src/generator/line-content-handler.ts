import {
    LineContent,
    isHeader,
    isList,
    isParagraph,
    isQuote,
    isMedia,
    isStyledElement,
    isFragmentElement,
    isNestedStyledElement,
    isCodeBlock,
    isSyncFragments,
    isEditor,
    isOutput,
    isQrCode
} from "../language/generated/ast";
import { ElementGenerator } from "./element-generator";
import { StyleParser } from "./style-parser";
import { FragmentParser } from "./fragment-parser";
import { IdeGenerator } from "./ide-generator";
import { IdeRuntimeGenerator } from "./ide-runtime";

/**
 * Handles the generation of HTML for different types of line content
 */
export class LineContentHandler {
    private elementGenerator: ElementGenerator;
    private styleParser: StyleParser;
    private fragmentParser: FragmentParser;
    private ideGenerator: IdeGenerator;
    private ideRuntime: IdeRuntimeGenerator;

    constructor(elementGenerator: ElementGenerator, styleParser: StyleParser, ideRuntime: IdeRuntimeGenerator) {
        this.elementGenerator = elementGenerator;
        this.styleParser = styleParser;
        this.fragmentParser = new FragmentParser();
        this.ideGenerator = new IdeGenerator();
        this.ideRuntime = ideRuntime;
    }

    /**
     * Get the element generator
     */
    public getElementGenerator(): ElementGenerator {
        return this.elementGenerator;
    }

    /**
     * Process a single line and generate appropriate HTML
     * @param line The line content to process
     * @returns Generated HTML string
     */
    public async generateLine(line: LineContent): Promise<string> {
        // Handle fragment elements first (animations)
        if (isFragmentElement(line)) {
            return await this.handleFragmentElement(line);
        }

        // Handle nested styled elements (::::)
        if (isNestedStyledElement(line)) {
            return await this.handleNestedStyledElement(line);
        }

        // Handle regular styled elements (:::)
        if (isStyledElement(line)) {
            return await this.handleStyledElement(line);
        }

        // Handle regular unstyled elements
        if (isHeader(line)) {
            return this.elementGenerator.generateHeading(line);
        }
        if (isList(line)) {
            return this.elementGenerator.generateList(line);
        }
        if (isQuote(line)) {
            return this.elementGenerator.generateQuote(line);
        }
        if (isMedia(line)) {
            return await this.elementGenerator.generateMedia(line);
        }
        if (isQrCode(line)) {
            return this.elementGenerator.generateQrCode(line);
        }
        if (isCodeBlock(line)) {
            return this.elementGenerator.generateCodeBlock(line);
        }
        if (isSyncFragments(line)) {
            return await this.elementGenerator.generateSyncFragments(line);
        }
        if (isEditor(line)) {
            this.ideRuntime.enable();
            return this.ideGenerator.generateEditor(line);
        }
        if (isOutput(line)) {
            this.ideRuntime.enable();
            return this.ideGenerator.generateOutput(line);
        }
        if (isParagraph(line)) {
            return this.elementGenerator.generateParagraph(line);
        }
        return '';
    }

    /**
     * Handle styled element containing multiple child elements
     * @param line The styled element
     * @param defaultWidth Optional default width to apply if no width is specified
     * @returns Generated HTML string
     */
    private async handleStyledElement(line: any, defaultWidth?: string): Promise<string> {
        // Use new parseStyleAttributes to support both classes and inline styles
        let attrs = this.styleParser.parseStyleAttributes(line.style);
        const elements = line.elements || [];

        // If defaultWidth is provided and no width in current style, add it
        if (defaultWidth) {
            const hasWidth = line.style && /width\s*:/.test(line.style);
            if (!hasWidth) {
                // Add default width
                const widthStyle = `width: ${defaultWidth}`;
                if (attrs.inlineStyles) {
                    // Insert width before the closing quote
                    attrs.inlineStyles = attrs.inlineStyles.replace(/"$/, `; ${widthStyle}"`);
                } else {
                    attrs.inlineStyles = ` style="${widthStyle}"`;
                }
            }
        }

        // Apply both classes and inline styles to the container div
        let containerHtml = `            <div${attrs.classes}${attrs.inlineStyles}${this.elementGenerator.getBlockPreviewAttributes(line)}>\n`;

        for (const element of elements) {
            if (isFragmentElement(element)) {
                // Handle nested fragments
                containerHtml += await this.handleFragmentElement(element) + '\n';
            } else if (isStyledElement(element)) {
                // Handle nested styled elements
                containerHtml += await this.handleStyledElement(element) + '\n';
            } else if (isHeader(element)) {
                containerHtml += this.elementGenerator.generateHeading(element, '') + '\n';
            } else if (isList(element)) {
                containerHtml += this.elementGenerator.generateList(element) + '\n';
            } else if (isQuote(element)) {
                containerHtml += this.elementGenerator.generateQuote(element, '') + '\n';
            } else if (isMedia(element)) {
                containerHtml += await this.elementGenerator.generateMedia(element, '') + '\n';
            } else if (isQrCode(element)) {
                containerHtml += this.elementGenerator.generateQrCode(element, '') + '\n';
            } else if (isCodeBlock(element)) {
                containerHtml += this.elementGenerator.generateCodeBlock(element, '') + '\n';
            } else if (isSyncFragments(element)) {
                containerHtml += await this.elementGenerator.generateSyncFragments(element) + '\n';
            } else if (isEditor(element)) {
                this.ideRuntime.enable();
                containerHtml += this.ideGenerator.generateEditor(element, '') + '\n';
            } else if (isOutput(element)) {
                this.ideRuntime.enable();
                containerHtml += this.ideGenerator.generateOutput(element, '') + '\n';
            } else if (isParagraph(element)) {
                containerHtml += this.elementGenerator.generateParagraph(element, '') + '\n';
            }
        }

        containerHtml += `            </div>`;
        return containerHtml;
    }

    /**
     * Handle fragment element containing multiple child elements
     * @param line The fragment element
     * @returns Generated HTML string
     */
    private async handleFragmentElement(line: any): Promise<string> {
        const fragmentAttrs = this.fragmentParser.parseFragment(line.fragment);
        const elements = line.elements || [];

        let containerHtml = `            <div${fragmentAttrs.class}${fragmentAttrs.dataAttrs}>\n`;

        for (const element of elements) {
            if (isFragmentElement(element)) {
                // Handle nested fragments
                containerHtml += await this.handleFragmentElement(element) + '\n';
            } else if (isStyledElement(element)) {
                // Handle nested styled elements
                containerHtml += await this.handleStyledElement(element) + '\n';
            } else if (isHeader(element)) {
                containerHtml += this.elementGenerator.generateHeading(element, '') + '\n';
            } else if (isList(element)) {
                containerHtml += this.elementGenerator.generateList(element) + '\n';
            } else if (isQuote(element)) {
                containerHtml += this.elementGenerator.generateQuote(element, '') + '\n';
            } else if (isMedia(element)) {
                containerHtml += await this.elementGenerator.generateMedia(element, '') + '\n';
            } else if (isCodeBlock(element)) {
                containerHtml += this.elementGenerator.generateCodeBlock(element, '') + '\n';
            } else if (isSyncFragments(element)) {
                containerHtml += await this.elementGenerator.generateSyncFragments(element) + '\n';
            } else if (isEditor(element)) {
                this.ideRuntime.enable();
                containerHtml += this.ideGenerator.generateEditor(element, '') + '\n';
            } else if (isOutput(element)) {
                this.ideRuntime.enable();
                containerHtml += this.ideGenerator.generateOutput(element, '') + '\n';
            } else if (isParagraph(element)) {
                containerHtml += this.elementGenerator.generateParagraph(element, '') + '\n';
            }
        }

        containerHtml += `            </div>`;
        return containerHtml;
    }

    /**
     * Handle nested styled element containing child StyledElements and other elements
     * Used for Reveal.js column layout with :::: delimiter
     * @param line The nested styled element
     * @returns Generated HTML string
     */
    private async handleNestedStyledElement(line: any): Promise<string> {
        // Use parseStyleAttributes to support both classes and inline styles
        let attrs = this.styleParser.parseStyleAttributes(line.style);
        const elements = line.elements || [];

        // If no display is specified in styles, add display: flex for column layout
        const hasDisplay = line.style && /display\s*:/.test(line.style);
        if (!hasDisplay) {
            const displayStyle = 'display: flex';
            if (attrs.inlineStyles) {
                // Insert display before the closing quote
                attrs.inlineStyles = attrs.inlineStyles.replace(/"$/, `; ${displayStyle}"`);
            } else {
                attrs.inlineStyles = ` style="${displayStyle}"`;
            }
        }

        // Apply both classes and inline styles to the container div
        let containerHtml = `            <div${attrs.classes}${attrs.inlineStyles}${this.elementGenerator.getBlockPreviewAttributes(line)}>\n`;

        for (const element of elements) {
            // Handle fragment elements (animations)
            if (isFragmentElement(element)) {
                containerHtml += await this.handleFragmentElement(element);
                containerHtml += '\n';
            }
            // Handle nested StyledElement (:::)
            else if (isStyledElement(element)) {
                // Add default width: 100% to children without explicit width (for flex layout)
                const defaultWidth = '100%';
                containerHtml += await this.handleStyledElement(element, defaultWidth);
                containerHtml += '\n';
            }
            // Handle other element types
            else if (isHeader(element)) {
                containerHtml += this.elementGenerator.generateHeading(element, '') + '\n';
            } else if (isList(element)) {
                containerHtml += this.elementGenerator.generateList(element) + '\n';
            } else if (isQuote(element)) {
                containerHtml += this.elementGenerator.generateQuote(element, '') + '\n';
            } else if (isMedia(element)) {
                containerHtml += await this.elementGenerator.generateMedia(element, '') + '\n';
            } else if (isCodeBlock(element)) {
                containerHtml += this.elementGenerator.generateCodeBlock(element, '') + '\n';
            } else if (isSyncFragments(element)) {
                containerHtml += await this.elementGenerator.generateSyncFragments(element) + '\n';
            } else if (isEditor(element)) {
                this.ideRuntime.enable();
                containerHtml += this.ideGenerator.generateEditor(element) + '\n';
            } else if (isOutput(element)) {
                this.ideRuntime.enable();
                containerHtml += this.ideGenerator.generateOutput(element) + '\n';
            } else if (isParagraph(element)) {
                containerHtml += this.elementGenerator.generateParagraph(element, '') + '\n';
            }
        }

        containerHtml += `            </div>`;
        return containerHtml;
    }

}
