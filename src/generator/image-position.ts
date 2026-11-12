export interface ImageOffset {
    x: number;
    y: number;
}

const sizeSuffix = /[ \t]*\{size:[ \t]*'(\d+(?:\.\d+)?)px[ \t]+(\d+(?:\.\d+)?)px'\}$/;
const offsetSuffix = /[ \t]*\{offset:[ \t]*'([-+]?\d+(?:\.\d+)?)px[ \t]+([-+]?\d+(?:\.\d+)?)px'\}(?=(?:[ \t]*\{size:|$))/;

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
    const size = sizeSuffix.exec(content)?.[0] ?? '';
    const base = content.replace(sizeSuffix, '').replace(offsetSuffix, '');
    return `${base}{offset: '${offset.x}px ${offset.y}px'}${size}`;
}

export function getImageSize(content: string): { width: number; height: number } | undefined {
    const match = sizeSuffix.exec(content);
    if (!match) return undefined;
    const width = Number(match[1]), height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('Image size must contain positive finite dimensions.');
    }
    return { width, height };
}

export function withImageSize(content: string, width: number, height: number): string {
    return `${content.replace(sizeSuffix, '')}{size: '${width}px ${height}px'}`;
}
