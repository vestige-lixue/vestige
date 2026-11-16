import { characterWidth } from "../width";

export type Boundary = "sentence" | "clause" | "ordinary";
export type TextRange = { from: number; to: number };
export type TextLayout = {
    text: string;
    offsets: number[];
    boundaries: Boundary[];
    lineBreaks: boolean[];
    widths: number[];
    leading: number[];
    trailing: number[];
    nextText: number[];
    previousText: number[];
    textCounts: number[];
};

function textWidth(text: string): number {
    let width = 0;
    for (const character of text) if (!/[\r\n]/u.test(character)) width += characterWidth(character.codePointAt(0)!);
    return width;
}

function previousOffset(text: string, offset: number): number {
    const last = text.charCodeAt(offset - 1), previous = text.charCodeAt(offset - 2);
    return offset - (last >= 0xdc00 && last <= 0xdfff && previous >= 0xd800 && previous <= 0xdbff ? 2 : 1);
}

function boundaryAfter(text: string, offset: number): Boundary {
    // Inspect only the ending codepoints, rather than rescanning the entire prefix.
    let start = offset;
    while (start > 0) {
        const previous = previousOffset(text, start);
        if (!/\s/u.test(text.slice(previous, start))) break;
        start = previous;
    }
    while (start > 0) {
        const previous = previousOffset(text, start);
        if (!/[\p{Pe}\p{Pf}"']/u.test(text.slice(previous, start))) break;
        start = previous;
    }
    const ending = start > 0 ? text.slice(previousOffset(text, start), start) : "";
    if (/\p{Sentence_Terminal}/u.test(ending)) return "sentence";
    if (/\p{Terminal_Punctuation}/u.test(ending)) return "clause";
    return "ordinary";
}

function blockedBoundary(text: string, offset: number): boolean {
    let next = offset;
    while (next < text.length) {
        const character = String.fromCodePoint(text.codePointAt(next)!);
        if (/[\r\n]/u.test(character) || !/\s/u.test(character)) {
            if (/[\p{Terminal_Punctuation}\p{Pe}\p{Pf}]/u.test(character)) return true;
            break;
        }
        next += character.length;
    }
    // Straight closing quotes follow the same rule as Unicode closing marks.
    return /["']/u.test(text[offset]) && offset > 0
        && /[\p{Terminal_Punctuation}\p{Pe}\p{Pf}"']/u.test(text.slice(previousOffset(text, offset), offset));
}

function openingMarks(text: string): Set<number> {
    const openings = new Set<number>();
    let offset = 0, previous = "", previousOpening = false;
    // Classify nested straight quotes once, keeping long quote sequences linear.
    for (const character of text) {
        const opening = /[\p{Ps}\p{Pi}]/u.test(character)
            || /["']/u.test(character) && (offset === 0 || /\s/u.test(previous) || previousOpening);
        if (opening) openings.add(offset);
        previous = character; previousOpening = opening;
        offset += character.length;
    }
    return openings;
}

function blockedAfterOpening(text: string, offset: number, openings: ReadonlySet<number>): boolean {
    while (offset > 0) {
        const previous = previousOffset(text, offset), character = text.slice(previous, offset);
        if (/[\r\n]/u.test(character)) return false;
        if (!/\s/u.test(character)) return openings.has(previous);
        offset = previous;
    }
    return false;
}

export function textLayout(text: string, language?: string): TextLayout {
    let locale: string | undefined;
    try {
        if (language) locale = Intl.Segmenter.supportedLocalesOf(language)[0];
    }
    catch {
        // Invalid or unsupported Run languages use the runtime's default locale.
    }
    const candidates = new Set([0, text.length]);
    for (const segment of new Intl.Segmenter(locale, { granularity: "word" }).segment(text)) candidates.add(segment.index);
    const newlines = new Set<number>();
    for (const match of text.matchAll(/\r\n|\r|\n/gu)) {
        newlines.add(match.index); newlines.add(match.index + match[0].length);
        candidates.add(match.index); candidates.add(match.index + match[0].length);
        if (match[0] === "\r\n") candidates.delete(match.index + 1);
    }
    const openings = openingMarks(text);
    const offsets = [...candidates].sort((a, b) => a - b).filter(offset => offset === 0 || offset === text.length || newlines.has(offset)
        || !blockedBoundary(text, offset) && !blockedAfterOpening(text, offset, openings));
    const layout: TextLayout = { text, offsets, boundaries: [], lineBreaks: [], widths: [0], leading: [], trailing: [], nextText: [], previousText: [-1], textCounts: [0] };
    for (let i = 0; i + 1 < offsets.length; i++) {
        const part = text.slice(offsets[i], offsets[i + 1]), width = textWidth(part), hasText = part.trim().length > 0;
        layout.widths.push(layout.widths[i] + width);
        layout.leading.push(width - textWidth(part.trimStart()));
        layout.trailing.push(width - textWidth(part.trimEnd()));
        layout.previousText.push(hasText ? i : layout.previousText[i]);
        layout.textCounts.push(layout.textCounts[i] + Number(hasText));
        layout.lineBreaks.push(/[\r\n]/u.test(part));
        layout.boundaries.push(boundaryAfter(text, offsets[i + 1]));
    }
    const count = offsets.length - 1;
    layout.nextText[count] = count;
    for (let i = count - 1; i >= 0; i--) layout.nextText[i] = layout.textCounts[i + 1] > layout.textCounts[i] ? i : layout.nextText[i + 1];
    return layout;
}

// Atoms are indivisible: ranges use atom indices, offsets convert them to UTF-16.
export function lineWidth(layout: TextLayout, from: number, to: number): number {
    const first = layout.nextText[from], last = layout.previousText[to];
    return first >= to ? 0 : layout.widths[last + 1] - layout.widths[first] - layout.leading[first] - layout.trailing[last];
}