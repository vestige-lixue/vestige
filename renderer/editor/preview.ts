import { type TranscriptInformation } from "./informationModel";
import { transcriptMarker, transcriptMarkerAnchor } from "./markers";

export type PreviewPart = {
    kind: "original" | "deleted" | "inserted" | "ellipsis" | "gap";
    text: string;
    gap?: TranscriptInformation;
};
// Truncation only removes whole units, even when a gap falls inside a grapheme cluster.
export type PreviewUnit = PreviewPart[];
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function previewUnits(text: string, kind: PreviewPart["kind"], gaps: readonly TranscriptInformation[] = [], sourceFrom = 0): PreviewUnit[] {
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
            parts.push({ kind, text: character });
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

export function comparisonPreview(parts: readonly { kind: PreviewPart["kind"]; text: string }[]): PreviewUnit[] {
    const groups: { kind: PreviewPart["kind"]; text: string }[] = [];
    for (const part of parts) {
        const previous = groups.at(-1);
        if (previous?.kind === part.kind) previous.text += part.text;
        else groups.push({ ...part });
    }
    return groups.flatMap(part => previewUnits(part.text, part.kind));
}

export function renderPreview(element: HTMLElement, units: readonly PreviewUnit[], options: { gap?: (gap: TranscriptInformation) => HTMLElement; suffix?: string; deletion?: boolean } = {}): void {
    const fragment = document.createDocumentFragment();
    const deletion = options.deletion ? document.createElement("span") : null;
    if (deletion) {
        deletion.className = "preview-deleted";
        fragment.append(deletion);
    }
    let span: HTMLSpanElement | null = null;
    let previous = "";
    for (const unit of units) {
        for (const part of unit) {
            if (part.gap) {
                const anchor = options.gap?.(part.gap) ?? transcriptMarkerAnchor(transcriptMarker(part.gap, { interactive: false }));
                anchor.dataset.previewGap = part.gap.key;
                (deletion ?? fragment).append(anchor);
                span = null;
                previous = "";
                continue;
            }
            if (deletion) {
                deletion.append(document.createTextNode(part.text));
                continue;
            }
            const className = `preview-${part.kind}`;
            if (!span || previous !== className || part.kind === "gap") {
                span = document.createElement("span");
                span.className = className;
                fragment.append(span);
            }
            span.append(document.createTextNode(part.text));
            previous = part.kind === "gap" ? "" : className;
        }
    }
    if (options.suffix) {
        const suffix = document.createElement("span");
        suffix.className = "preview-suffix";
        suffix.textContent = `\u00a0${options.suffix}`;
        fragment.append(suffix);
    }
    element.replaceChildren(fragment);
}

export function fitPreview(element: HTMLElement, options: { units: readonly PreviewUnit[]; compact: boolean; suffix?: string; deletion?: boolean }): { update: (next: typeof options) => void; destroy: () => void } {
    let frame = 0;
    let destroyed = false;
    function measure(): void {
        frame = 0;
        if (destroyed || !element.clientWidth) return;
        const style = getComputedStyle(element);
        const height = parseFloat(style.lineHeight) * (options.compact ? 1 : 4) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        function fits(count: number): boolean {
            renderPreview(element, middlePreview(options.units, count), options);
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
    renderPreview(element, options.units, options);
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