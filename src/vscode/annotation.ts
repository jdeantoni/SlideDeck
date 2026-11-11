export type AnnotationTool = 'pen' | 'rectangle' | 'ellipse' | 'arrow';
export interface AnnotationPoint { x: number; y: number }
export interface AnnotationStroke {
    tool: AnnotationTool;
    color: string;
    width: number;
    points: AnnotationPoint[];
}

export function validateAnnotations(value: unknown): value is AnnotationStroke[] {
    if (!Array.isArray(value) || value.length === 0 || value.length > 100) return false;
    return value.every(stroke => {
        if (!stroke || typeof stroke !== 'object' ||
            !['pen', 'rectangle', 'ellipse', 'arrow'].includes(stroke.tool) ||
            typeof stroke.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(stroke.color) ||
            typeof stroke.width !== 'number' || !Number.isFinite(stroke.width) ||
            stroke.width < 1 || stroke.width > 30 ||
            !Array.isArray(stroke.points) || stroke.points.length < 2 || stroke.points.length > 2000) return false;
        return stroke.points.every((point: unknown) => {
            if (!point || typeof point !== 'object') return false;
            const p = point as Partial<AnnotationPoint>;
            return typeof p.x === 'number' && Number.isFinite(p.x) && Math.abs(p.x) <= 10000 &&
                typeof p.y === 'number' && Number.isFinite(p.y) && Math.abs(p.y) <= 10000;
        });
    });
}

function number(value: number): string {
    return String(Math.round(value * 10) / 10);
}

function polyline(points: AnnotationPoint[], closed = false): string {
    const first = points[0];
    let path = `M ${number(first.x)} ${number(first.y)}`;
    for (let i = 1; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        path += ` Q ${number(current.x)} ${number(current.y)} ${number((current.x + next.x) / 2)} ${number((current.y + next.y) / 2)}`;
    }
    const last = points[points.length - 1];
    return `${path} L ${number(last.x)} ${number(last.y)}${closed ? ' Z' : ''}`;
}

export function annotationSvg(stroke: AnnotationStroke, width: number, height: number): string {
    const first = stroke.points[0];
    const last = stroke.points[stroke.points.length - 1];
    let points = stroke.points;
    let closed = false;
    if (stroke.tool === 'rectangle' || stroke.tool === 'ellipse') {
        const x = (first.x + last.x) / 2, y = (first.y + last.y) / 2;
        const rx = Math.abs(last.x - first.x) / 2, ry = Math.abs(last.y - first.y) / 2;
        points = Array.from({ length: 49 }, (_, i) => {
            const angle = i * Math.PI * 2 / 48;
            const wobble = 1 + 0.025 * Math.sin(i * 1.7);
            if (stroke.tool === 'ellipse') return { x: x + rx * Math.cos(angle) * wobble, y: y + ry * Math.sin(angle) * wobble };
            const scale = Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
            return { x: x + rx * Math.cos(angle) / scale * wobble, y: y + ry * Math.sin(angle) / scale * wobble };
        });
        closed = true;
    } else if (stroke.tool === 'arrow') {
        const angle = Math.atan2(last.y - first.y, last.x - first.x);
        const size = Math.max(12, stroke.width * 4);
        points = [first, last];
        const left = { x: last.x - size * Math.cos(angle - 0.45), y: last.y - size * Math.sin(angle - 0.45) };
        const right = { x: last.x - size * Math.cos(angle + 0.45), y: last.y - size * Math.sin(angle + 0.45) };
        points.push(left, last, right);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${number(width)} ${number(height)}" width="${number(width)}" height="${number(height)}"><path d="${polyline(points, closed)}" fill="none" stroke="${stroke.color}" stroke-width="${number(stroke.width)}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
