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

export function withAnnotationScale(content: string, style: string | undefined,
    scale: { x: number; y: number; originX: number; originY: number }): string {
    if (!style || !/(?:^|[\s{;,])\.sd-annotation-layer(?=[\s;},])/.test(style)) {
        throw new Error('Cannot resize a block that is not an annotation layer.');
    }
    const index = content.indexOf(style);
    if (index < 0) throw new Error('Cannot locate the annotation style.');
    let body = style.slice(1, -1);
    for (const [key, value] of [
        ['--sd-annotation-scale-x', String(scale.x)],
        ['--sd-annotation-scale-y', String(scale.y)],
        ['transform-origin', `${scale.originX}px ${scale.originY}px`]
    ]) {
        const pattern = new RegExp(`(^|[;,])\\s*${key}\\s*:\\s*(?:'[^']*'|"[^"]*"|[^;,]*)`, 'g');
        body = body.replace(pattern, '$1').replace(/[;,]\s*(?=[;,])/g, '').replace(/[;,]\s*$/, '');
        body += `; ${key}: '${value}'`;
    }
    return content.slice(0, index) + `{${body}}` + content.slice(index + style.length);
}
