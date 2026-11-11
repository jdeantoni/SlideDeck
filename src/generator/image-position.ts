export interface ImageOffset {
    x: number;
    y: number;
}

const offsetSuffix = /[ \t]*\{offset:[ \t]*'([-+]?\d+(?:\.\d+)?)px[ \t]+([-+]?\d+(?:\.\d+)?)px'\}$/;

export function getImageOffset(content: string): ImageOffset {
    const match = offsetSuffix.exec(content);
    if (!match) return { x: 0, y: 0 };
    const offset = { x: Number(match[1]), y: Number(match[2]) };
    if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) {
        throw new Error('Image offsets must be finite numbers.');
    }
    return offset;
}

export function withImageOffset(content: string, offset: ImageOffset): string {
    return `${content.replace(offsetSuffix, '')}{offset: '${offset.x}px ${offset.y}px'}`;
}
