import { ImageOffset } from './image-position';

const translation = /(?:^|[;,])\s*translate\s*:\s*['"]?([-+]?\d+(?:\.\d+)?)px\s+([-+]?\d+(?:\.\d+)?)px['"]?\s*(?=[;,]|$)/;

export function getBlockOffset(style?: string): ImageOffset | undefined {
    if (!style) return { x: 0, y: 0 };
    const body = style.slice(1, -1);
    const match = translation.exec(body);
    if (!match) return /(?:^|[;,])\s*translate\s*:/.test(body) ? undefined : { x: 0, y: 0 };
    const offset = { x: Number(match[1]), y: Number(match[2]) };
    return Number.isFinite(offset.x) && Number.isFinite(offset.y) ? offset : undefined;
}

export function withBlockOffset(content: string, style: string | undefined, offset: ImageOffset): string {
    const opening = /^:{3,4}/.exec(content);
    if (!opening) throw new Error('Cannot locate the opening block delimiter.');
    const value = `translate: '${offset.x}px ${offset.y}px'`;
    if (!style) return `${content.slice(0, opening[0].length)} {${value}}${content.slice(opening[0].length)}`;
    const index = content.indexOf(style, opening[0].length);
    if (index < 0) throw new Error('Cannot locate the block style.');
    const body = style.slice(1, -1);
    const updated = translation.test(body)
        ? body.replace(translation, match => `${match.startsWith(';') || match.startsWith(',') ? match[0] + ' ' : ''}${value}`)
        : `${body}${body.trim() ? '; ' : ''}${value}`;
    return content.slice(0, index) + `{${updated}}` + content.slice(index + style.length);
}
