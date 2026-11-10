/**
 * Parsed style attributes result containing both inline styles and CSS classes
 */
export interface ParsedStyleAttributes {
    inlineStyles: string;  // ` style="..."` or empty string
    classes: string;       // ` class="..."` or empty string
}

/**
 * Style parser for handling CSS style attributes with abstractions
 */
export class StyleParser {
    /**
     * Transform keywords mapping to CSS transform functions
     */
    private readonly TRANSFORM_KEYWORDS: Record<string, (val: string) => string> = {
        'rotate': (val) => `rotate(${val}deg)`,
        'scale': (val) => `scale(${val})`,
        'translate-x': (val) => `translateX(${val}px)`,
        'translate-y': (val) => `translateY(${val}px)`,
        'skew': (val) => `skew(${val}deg)`
    };

    /**
     * Parse transform keywords and combine them into a single transform property
     * @param pairs Array of parsed key-value pairs
     * @returns Transform CSS string and list of consumed keys
     */
    private parseTransforms(pairs: Array<{key: string, value: string}>): {
        style: string;
        consumedKeys: string[];
    } {
        const transformParts: string[] = [];
        const consumed: string[] = [];

        for (const {key, value} of pairs) {
            if (key in this.TRANSFORM_KEYWORDS) {
                transformParts.push(this.TRANSFORM_KEYWORDS[key](value));
                consumed.push(key);
            }
        }

        if (transformParts.length === 0) {
            return {style: '', consumedKeys: []};
        }

        return {
            style: `transform: ${transformParts.join(' ')}`,
            consumedKeys: consumed
        };
    }

    /**
     * Parse layout shortcut keywords (columns, gap) and generate grid CSS
     * @param pairs Array of parsed key-value pairs
     * @returns Layout CSS strings and list of consumed keys
     */
    private parseLayoutShortcuts(pairs: Array<{key: string, value: string}>): {
        styles: string[];
        consumedKeys: string[];
    } {
        const layoutStyles: string[] = [];
        const consumed: string[] = [];

        for (const {key, value} of pairs) {
            if (key === 'columns') {
                const count = parseInt(value);
                if (!isNaN(count) && count > 0) {
                    const cols = Array(count).fill('1fr').join(' ');
                    layoutStyles.push('display: grid');
                    layoutStyles.push(`grid-template-columns: ${cols}`);
                    consumed.push(key);
                }
            } else if (key === 'gap') {
                layoutStyles.push(`gap: ${value}px`);
                consumed.push(key);
            }
        }

        return {styles: layoutStyles, consumedKeys: consumed};
    }

    /**
     * Parse style attributes from style block
     * @param styleBlock Style attributes like {color: 'red', top: 200} or {calque: 10, horizontal-margin: 200}
     * @returns HTML style attribute string
     */
    public parseStyle(styleBlock: string): string {
        if (!styleBlock) return '';

        try {
            // Remove outer braces
            const content = styleBlock.replace(/^\{|\}$/g, '').trim();
            if (!content) return '';

            // Parse key-value pairs (support both semicolon and comma separators)
            const styles: string[] = [];
            let hasAbsoluteKeywords = false;

            // Split by semicolon or comma, but not inside parentheses (use smartSplit for gradients)
            const pairs = this.smartSplit(content).map(pair => pair.trim()).filter(pair => pair.length > 0);

            // Parse key-value pairs into structured format
            const parsedPairs = pairs.map(pair => {
                const colonIndex = pair.indexOf(':');
                if (colonIndex === -1) return null;

                const key = pair.substring(0, colonIndex).trim();
                const value = pair.substring(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
                return {key, value};
            }).filter(p => p !== null) as Array<{key: string, value: string}>;

            // Handle transforms first (must be combined into single property)
            const {style: transformStyle, consumedKeys: transformConsumed} =
                this.parseTransforms(parsedPairs);

            if (transformStyle) {
                styles.push(transformStyle);
            }

            // Handle layout shortcuts (columns, gap)
            const {styles: layoutStyles, consumedKeys: layoutConsumed} =
                this.parseLayoutShortcuts(parsedPairs);

            styles.push(...layoutStyles);

            // Check if width is specified (for Reveal.js column fix)
            const hasWidth = parsedPairs.some(p => p.key === 'width');

            // Process remaining pairs (exclude consumed keys from transforms and layouts)
            const processedStyles = parsedPairs
                .filter(p => !transformConsumed.includes(p.key) && !layoutConsumed.includes(p.key))
                .map(({key, value}) => {
                    // Handle transparency (convert percentage to opacity)
                    if (key === 'transparency') {
                        const opacity = parseFloat(value) / 100;
                        return `opacity: ${opacity}`;
                    }

                    // Check for simplified keywords (existing)
                    if (key === 'calque') {
                        hasAbsoluteKeywords = true;
                        return `z-index: ${value}`;
                    } else if (key === 'horizontal-margin') {
                        hasAbsoluteKeywords = true;
                        return `left: ${value}px`;
                    } else if (key === 'vertical-margin') {
                        hasAbsoluteKeywords = true;
                        return `top: ${value}px`;
                    } else {
                        // Regular CSS property
                        return `${key}: ${value}`;
                    }
                })
                .filter(style => style !== null);

            // If absolute positioning keywords were used, add position: absolute
            if (hasAbsoluteKeywords) {
                styles.push('position: absolute');
            }

            // If width is specified, add flex: none to override Reveal.js default flex: 1
            if (hasWidth) {
                styles.push('flex: none');
            }

            styles.push(...processedStyles);

            return ` style="${styles.join('; ')}"`;
        } catch (e) {
            return '';
        }
    }

    /**
     * Split CSS properties by semicolon or comma, but not inside parentheses
     * This handles cases like linear-gradient(135deg, #667eea 0%, #764ba2 100%)
     * and box-shadow with multiple shadows: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)
     *
     * Strategy: Split only on semicolons, or on commas that are followed by a property name (word followed by colon)
     * @param content CSS properties string
     * @returns Array of property pairs
     */
    private smartSplit(content: string): string[] {
        const result: string[] = [];
        let current = '';
        let depth = 0;
        let quote = '';
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];

            if (quote) {
                current += char;
                if (char === '\\' && i + 1 < content.length) {
                    current += content[++i];
                } else if (char === quote) {
                    quote = '';
                }
            } else if (char === "'" || char === '"') {
                quote = char;
                current += char;
            } else if (char === '(') {
                depth++;
                current += char;
            } else if (char === ')') {
                depth--;
                current += char;
            } else if (char === ';' && depth === 0) {
                // Always split on semicolon if we're not inside parentheses
                if (current.trim()) {
                    result.push(current.trim());
                }
                current = '';
            } else if (char === ',' && depth === 0) {
                // Only split on comma if the next part looks like a property (has a colon for key:value)
                // Look ahead to see if this comma separates properties or is part of a value
                const remaining = content.substring(i + 1).trim();
                // Check if remaining starts with word characters followed by colon
                if (/^[a-zA-Z-]+\s*:/.test(remaining)) {
                    // This comma separates properties
                    if (current.trim()) {
                        result.push(current.trim());
                    }
                    current = '';
                } else {
                    // This comma is part of the value (like in box-shadow or transform)
                    current += char;
                }
            } else {
                current += char;
            }
        }

        // Add the last property
        if (current.trim()) {
            result.push(current.trim());
        }

        return result;
    }

    /**
     * Parse inline span attributes without applying block layout shortcuts.
     * Invalid attributes are rejected so their source can be displayed literally.
     */
    public parseInlineAttributes(content: string): {classes: string[], styles: string[], note?: string, footnote?: string} | undefined {
        const classes: string[] = [];
        const styles: string[] = [];
        let note: string | undefined;
        let footnote: string | undefined;
        for (const part of this.smartSplit(content)) {
            let remaining = part.trim();
            while (remaining.startsWith('.')) {
                const match = /^\.([a-zA-Z][a-zA-Z0-9_-]*)(?=\s|$)/.exec(remaining);
                if (!match) return undefined;
                classes.push(match[1]);
                remaining = remaining.slice(match[0].length).trim();
            }
            if (!remaining) continue;

            const property = /^((?:--[a-zA-Z0-9_-]+|[a-zA-Z][a-zA-Z0-9-]*))\s*:\s*(.+)$/.exec(remaining);
            if (!property) return undefined;
            let value = property[2].trim();
            if (property[1] === 'note' || property[1] === 'footnote') {
                const match = /^(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")$/.exec(value);
                if (!match || (property[1] === 'note' ? note !== undefined : footnote !== undefined)) return undefined;
                const quote = value[0];
                const text = (match[1] ?? match[2]).replace(/\\(.)/g, (original, char: string) =>
                    char === quote || char === '\\' ? char : original
                );
                if (!text) return undefined;
                if (property[1] === 'note') note = text;
                else footnote = text;
                continue;
            }
            if (value.startsWith("'") || value.startsWith('"')) {
                if (value.length < 2 || value[value.length - 1] !== value[0]) return undefined;
                value = value.slice(1, -1);
            }
            if (!value) return undefined;
            styles.push(`${property[1]}: ${value}`);
        }
        return classes.length || styles.length || note !== undefined || footnote !== undefined
            ? {classes, styles, note, footnote} : undefined;
    }

    /**
     * Parse class attributes from style block
     * Extracts patterns like .classname or .class-name-123
     * @param styleBlock Style block that may contain class syntax
     * @returns Array of class names (without the dot prefix)
     */
    private parseClassAttributes(styleBlock: string): string[] {
        // Match patterns: .classname or .class-name-123
        const classPattern = /\.([a-zA-Z][a-zA-Z0-9\-_]*)/g;
        const classes: string[] = [];
        let match;

        while ((match = classPattern.exec(styleBlock)) !== null) {
            classes.push(match[1]);
        }

        return classes;
    }

    /**
     * Parse style attributes and class attributes from style block
     * Separates class syntax (.classname) from inline style syntax
     * @param styleBlock Style block like {.column; width: '40%'} or {columns: 2; .myclass}
     * @returns Object with separate inline styles and classes
     */
    public parseStyleAttributes(styleBlock: string): ParsedStyleAttributes {
        if (!styleBlock) {
            return {inlineStyles: '', classes: ''};
        }

        try {
            // Extract classes first
            const classes = this.parseClassAttributes(styleBlock);

            // Remove class syntax from style block before parsing styles
            const styleOnly = styleBlock.replace(/\.([a-zA-Z][a-zA-Z0-9\-_]*)/g, '').trim();

            // Parse remaining styles using existing parseStyle method
            const inlineStyles = this.parseStyle(styleOnly);

            // Build class attribute
            const classAttr = classes.length > 0
                ? ` class="${classes.join(' ')}"`
                : '';

            return {inlineStyles, classes: classAttr};
        } catch (e) {
            return {inlineStyles: '', classes: ''};
        }
    }
}
