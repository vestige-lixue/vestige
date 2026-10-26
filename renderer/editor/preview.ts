import { type TranscriptInformation } from "./informationModel";

export type PreviewPart = {
    kind: "original" | "deleted" | "inserted" | "ellipsis" | "gap";
    text: string;
    whitespace?: boolean;
    lineBreak?: boolean;
    gap?: TranscriptInformation;
};
// Truncation only removes whole units, even when a gap falls inside a grapheme cluster.
export type PreviewUnit = PreviewPart[];
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function previewUnits(text: string, kind: PreviewPart["kind"], gaps: readonly TranscriptInformation[] = [], sourceFrom = 0): PreviewUnit[] {
    const characters = Array.from(text);
    const onlyWhitespace = /^\s*$/u.test(text);
    const markers = new Map<number, TranscriptInformation[]>();
    for (const gap of gaps) {
        const offset = gap.sourceFrom - sourceFrom;
        const items = markers.get(offset) ?? [];
        items.push(gap);
        markers.set(offset, items);
    }
    function gapParts(offset: number): PreviewPart[] {
        return (markers.get(offset) ?? []).map(gap => ({ kind: "gap", text: "▼", gap }));
    }
    const units: PreviewUnit[] = [];
    let offset = 0;
    for (const grapheme of segmenter.segment(text)) {
        const parts: PreviewPart[] = [];
        for (const character of grapheme.segment) {
            parts.push(...gapParts(offset));
            const lineBreak = character === "\n" || character === "\r";
            const space = character === " " && (onlyWhitespace || offset === 0 || offset === characters.length - 1
                || characters[offset - 1] === " " || characters[offset + 1] === " ");
            const whitespace = lineBreak || character === "\t" || space || onlyWhitespace && /\s/u.test(character);
            const value = lineBreak ? character === "\n" && characters[offset - 1] === "\r" ? "" : "↵"
                : character === "\t" ? "→" : whitespace ? "·" : character;
            if (value) parts.push({ kind, text: value, whitespace, lineBreak });
            offset++;
        }
        units.push(parts);
    }
    const trailing = gapParts(offset);
    if (trailing.length) {
        if (units.length) units[units.length - 1].push(...trailing);
        else units.push(trailing);
    }
    return units;
}

export function middlePreview(units: readonly PreviewUnit[], count: number): readonly PreviewUnit[] {
    if (count >= units.length) return units;
    const start = Math.ceil(count / 2);
    const end = Math.floor(count / 2);
    return [...units.slice(0, start), [{ kind: "ellipsis", text: "…" }], ...end ? units.slice(-end) : []];
}

export function renderPreview(element: HTMLElement, units: readonly PreviewUnit[]): void {
    const fragment = document.createDocumentFragment();
    let span: HTMLSpanElement | null = null;
    let previous = "";
    for (const unit of units) {
        for (const part of unit) {
            const className = `preview-${part.kind}`;
            if (!span || previous !== className || part.kind === "gap") {
                span = document.createElement("span");
                span.className = className;
                fragment.append(span);
            }
            if (part.whitespace) {
                const whitespace = document.createElement("span");
                whitespace.className = "preview-whitespace";
                whitespace.textContent = part.text;
                span.append(whitespace);
            }
            else span.append(document.createTextNode(part.text));
            if (part.gap) span.dataset.previewGap = part.gap.key;
            previous = part.kind === "gap" ? "" : className;
        }
    }
    element.replaceChildren(fragment);
}

export function fitPreview(element: HTMLElement, options: { units: readonly PreviewUnit[]; compact: boolean }): { update: (next: typeof options) => void; destroy: () => void } {
    let frame = 0;
    let destroyed = false;
    function measure(): void {
        frame = 0;
        if (destroyed || !element.clientWidth) return;
        const height = parseFloat(getComputedStyle(element).lineHeight) * (options.compact ? 1 : 4);
        function fits(count: number): boolean {
            renderPreview(element, middlePreview(options.units, count));
            // Inline box decoration can overhang the line box without creating an extra line.
            return element.getBoundingClientRect().height <= height + 1 && element.scrollWidth <= element.clientWidth + 1;
        }
        if (fits(options.units.length)) return;
        let low = 0;
        let high = options.units.length;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if (fits(middle)) low = middle;
            else high = middle - 1;
        }
        fits(low);
    }
    function schedule(): void {
        if (destroyed) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    document.fonts.ready.then(schedule);
    renderPreview(element, options.units);
    schedule();
    return {
        update(next) {
            options = next;
            schedule();
        },
        destroy() {
            destroyed = true;
            observer.disconnect();
            cancelAnimationFrame(frame);
        }
    };
}