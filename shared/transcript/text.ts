import { type Modification } from "../Vestige";
import { type Segment } from "../transcription/Run";
import { type TextPosition, type Range } from "../util/range";

export type TextIndex = {
    transcript: readonly Segment[];
    starts: number[];
    characters: string[];
};

export type TextSource = ({
    kind: "segment";
    index: number;
} | {
    kind: "modification";
    index: number;
});

export type TextPiece = {
    from: number;
    to: number;
    sourceFrom: number;
    sourceTo: number;
    source: TextSource;
    text: string;
};

type Patch = { from: number; to: number; text: string };

export type TextProjection = {
    text: string;
    length: number;
    pieces: TextPiece[];
    modifications: Modification[];
};

export function createTextIndex(transcript: readonly Segment[]): TextIndex {
    const starts: number[] = [];
    const characters: string[] = [];
    for (const segment of transcript) {
        starts.push(characters.length);
        for (const character of segment.token.text) characters.push(character);
    }
    starts.push(characters.length);
    return { transcript, starts, characters };
}

export function textOffset(index: TextIndex, position: TextPosition): number {
    const { segmentIdx, offset } = position;
    const count = index.transcript.length;
    if (!Number.isSafeInteger(segmentIdx) || !Number.isSafeInteger(offset) || segmentIdx < 0 || segmentIdx > count || offset < 0) {
        throw new RangeError("Invalid text position.");
    }
    if (segmentIdx === count) {
        if (offset !== 0) throw new RangeError("EOF offset must be zero.");
        return index.characters.length;
    }
    if (offset >= index.starts[segmentIdx + 1] - index.starts[segmentIdx]) throw new RangeError("Offset must precede a codepoint.");
    return index.starts[segmentIdx] + offset;
}

export function textPosition(index: TextIndex, offset: number): TextPosition {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > index.characters.length) throw new RangeError("Invalid text offset.");
    if (offset === index.characters.length) return { segmentIdx: index.transcript.length, offset: 0 };
    let low = 0;
    let high = index.transcript.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (index.starts[middle] <= offset) low = middle + 1;
        else high = middle;
    }
    const segmentIdx = low - 1;
    return { segmentIdx, offset: offset - index.starts[segmentIdx] };
}

function patchOf(index: TextIndex, modification: Modification): Patch {
    return {
        from: textOffset(index, modification.range.start),
        to: textOffset(index, modification.range.end),
        text: modification.text
    };
}

function modificationOf(index: TextIndex, patch: Patch): Modification {
    return {
        range: { start: textPosition(index, patch.from), end: textPosition(index, patch.to) },
        text: patch.text
    };
}

export function normalizeModifications(index: TextIndex, modifications: readonly Modification[]): Modification[] {
    const patches = modifications.map(modification => patchOf(index, modification)).sort((a, b) => a.from - b.from || a.to - b.to);
    const normalized: Patch[] = [];
    for (const patch of patches) {
        if (patch.to < patch.from) throw new RangeError("Reversed modification range.");
        const previous = normalized.at(-1);
        if (previous && patch.from < previous.to) throw new RangeError("Overlapping modifications.");
        if (patch.text === index.characters.slice(patch.from, patch.to).join("")) continue;
        if (previous && previous.from === previous.to && patch.from === patch.to && previous.from === patch.from) {
            previous.text += patch.text;
        }
        else normalized.push(patch);
    }
    return normalized.map(patch => modificationOf(index, patch));
}

export function projectText(index: TextIndex, modifications: readonly Modification[]): TextProjection {
    const normalized = normalizeModifications(index, modifications);
    const pieces: TextPiece[] = [];
    let length = 0;
    let cursor = 0;
    function add(sourceFrom: number, sourceTo: number, text: string, source: TextSource): void {
        const to = length + Array.from(text).length;
        pieces.push({ from: length, to, sourceFrom, sourceTo, text, source });
        length = to;
    }
    function original(to: number): void {
        while (cursor < to) {
            const { segmentIdx } = textPosition(index, cursor);
            const end = Math.min(to, index.starts[segmentIdx + 1]);
            add(cursor, end, index.characters.slice(cursor, end).join(""), { kind: "segment", index: segmentIdx });
            cursor = end;
        }
    }
    normalized.forEach((modification, modificationIdx) => {
        const patch = patchOf(index, modification);
        original(patch.from);
        add(patch.from, patch.to, patch.text, { kind: "modification", index: modificationIdx });
        cursor = patch.to;
    });
    original(index.characters.length);
    return { text: pieces.map(piece => piece.text).join(""), length, pieces, modifications: normalized };
}

function sourceBoundary(index: TextIndex, projection: TextProjection, position: number, end: boolean, included: ReadonlySet<number>): number {
    const candidates: number[] = [];
    for (const piece of projection.pieces) {
        if (position < piece.from || position > piece.to) continue;
        if (piece.source.kind === "segment") candidates.push(piece.sourceFrom + position - piece.from);
        else if (included.has(piece.source.index)) {
            if (position === piece.from) candidates.push(piece.sourceFrom);
            if (position === piece.to) candidates.push(piece.sourceTo);
        }
    }
    if (!candidates.length) return index.characters.length;
    return candidates.reduce((result, value) => end ? Math.max(result, value) : Math.min(result, value));
}

// from/to address the current rendered text. Persisted ranges always address the original Run.
export function editText(index: TextIndex, projection: TextProjection, from: number, to: number, text: string): TextProjection {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from || to > projection.length) {
        throw new RangeError("Invalid rendered text range.");
    }
    const characters = Array.from(projection.text);
    if (characters.slice(from, to).join("") === text) return projection;
    const modified = projection.pieces.filter(piece => piece.source.kind === "modification");
    let touched: TextPiece[];
    if (from === to) {
        // A collapsed deletion remains an editable source range, including after deleting all text.
        touched = modified.filter(piece => piece.from === from && piece.to === from);
        if (!touched.length) {
            const piece = modified.find(piece => piece.from < from && from < piece.to)
                ?? modified.find(piece => piece.to === from)
                ?? modified.find(piece => piece.from === from);
            touched = piece ? [piece] : [];
        }
    }
    else touched = modified.filter(piece => piece.from === piece.to
        ? piece.from >= from && piece.from <= to
        : piece.from < to && piece.to > from);
    const renderedFrom = touched.reduce((result, piece) => Math.min(result, piece.from), from);
    const renderedTo = touched.reduce((result, piece) => Math.max(result, piece.to), to);
    const removed = new Set(touched.map(piece => piece.source.index));
    const sourceFrom = touched.reduce((result, piece) => Math.min(result, piece.sourceFrom), sourceBoundary(index, projection, renderedFrom, false, removed));
    const sourceTo = touched.reduce((result, piece) => Math.max(result, piece.sourceTo), sourceBoundary(index, projection, renderedTo, true, removed));
    const modifications = projection.modifications.filter((_, modificationIdx) => !removed.has(modificationIdx));
    const replacement = characters.slice(renderedFrom, from).join("") + text + characters.slice(to, renderedTo).join("");
    modifications.push(modificationOf(index, { from: sourceFrom, to: sourceTo, text: replacement }));
    return projectText(index, modifications);
}

export function codepointToUtf16(text: string, offset: number): number {
    let position = 0;
    let count = 0;
    for (const character of text) {
        if (count === offset) return position;
        position += character.length;
        count++;
    }
    if (count === offset) return position;
    throw new RangeError("Invalid codepoint offset.");
}

export function utf16ToCodepoint(text: string, offset: number): number {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > text.length) throw new RangeError("Invalid UTF-16 offset.");
    let position = 0;
    let count = 0;
    for (const character of text) {
        if (position === offset) return count;
        position += character.length;
        count++;
        if (position > offset) throw new RangeError("Position splits a codepoint.");
    }
    return count;
}

function sourceTime(index: TextIndex, offset: number, end: boolean): number | null {
    if (!index.transcript.length) return null;
    if (!index.characters.length || offset === index.characters.length && !end) return index.transcript.at(-1)!.range.end;
    const preceding = end && offset > 0;
    const position = textPosition(index, preceding ? offset - 1 : offset);
    const segment = index.transcript[position.segmentIdx];
    const length = index.starts[position.segmentIdx + 1] - index.starts[position.segmentIdx];
    return segment.range.start + (segment.range.end - segment.range.start) * (position.offset + Number(preceding)) / length;
}

export function pieceTime(index: TextIndex, piece: TextPiece): Range | null {
    const start = sourceTime(index, piece.sourceFrom, false);
    const end = piece.sourceFrom === piece.sourceTo ? start : sourceTime(index, piece.sourceTo, true);
    return start === null || end === null ? null : { start, end: Math.max(start, end) };
}

export function timeAtTextOffset(index: TextIndex, projection: TextProjection, offset: number): number | null {
    const piece = projection.pieces.find(piece => piece.from <= offset && offset < piece.to) ?? projection.pieces.at(-1);
    if (!piece) return sourceTime(index, index.characters.length, false);
    const range = pieceTime(index, piece);
    if (!range) return null;
    const fraction = piece.to === piece.from ? 0 : Math.max(0, Math.min(1, (offset - piece.from) / (piece.to - piece.from)));
    return range.start + (range.end - range.start) * fraction;
}