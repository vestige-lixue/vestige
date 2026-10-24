import { type Modification } from "../Vestige";
import { type TranscriptSpan } from "../transcription/Run";
import { type TextPosition } from "../util/range";

export type TextIndex = {
    transcript: readonly TranscriptSpan[];
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

export type TextProjection = {
    text: string;
    length: number;
    pieces: TextPiece[];
    modifications: Modification[];
};

export function createTextIndex(transcript: readonly TranscriptSpan[]): TextIndex {
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

function deletionOf(index: TextIndex, from: number, to: number): Modification {
    return { type: "delete", range: { start: textPosition(index, from), end: textPosition(index, to) } };
}

function insertionOf(index: TextIndex, position: number, text: string): Modification {
    return { type: "insert", pos: textPosition(index, position), text };
}

export function normalizeModifications(index: TextIndex, modifications: readonly Modification[]): Modification[] {
    const deletions: { from: number; to: number }[] = [];
    const insertions: { position: number; text: string }[] = [];
    for (const modification of modifications) {
        if (modification.type === "insert") {
            const position = textOffset(index, modification.pos);
            if (modification.text) insertions.push({ position, text: modification.text });
        }
        else {
            const from = textOffset(index, modification.range.start);
            const to = textOffset(index, modification.range.end);
            if (to < from) throw new RangeError("Reversed modification range.");
            if (from < to) deletions.push({ from, to });
        }
    }
    deletions.sort((left, right) => left.from - right.from || left.to - right.to);
    const merged: typeof deletions = [];
    for (const deletion of deletions) {
        const previous = merged.at(-1);
        if (previous && deletion.from < previous.to) throw new RangeError("Overlapping deletions.");
        if (previous && deletion.from === previous.to) previous.to = deletion.to;
        else merged.push(deletion);
    }
    // Stable source order preserves displayed insertion order when a deletion absorbs their anchors.
    insertions.sort((left, right) => left.position - right.position);
    const anchored: typeof insertions = [];
    let deletionIndex = 0;
    for (const insertion of insertions) {
        while (deletionIndex < merged.length && merged[deletionIndex].to < insertion.position) deletionIndex++;
        const deletion = merged[deletionIndex];
        const position = deletion && deletion.from <= insertion.position ? deletion.from : insertion.position;
        const previous = anchored.at(-1);
        if (previous && previous.position === position) previous.text += insertion.text;
        else anchored.push({ position, text: insertion.text });
    }
    const normalized: Modification[] = [];
    let insertionIndex = 0;
    for (const deletion of merged) {
        while (insertionIndex < anchored.length && anchored[insertionIndex].position <= deletion.from) {
            const insertion = anchored[insertionIndex++];
            normalized.push(insertionOf(index, insertion.position, insertion.text));
        }
        normalized.push(deletionOf(index, deletion.from, deletion.to));
    }
    for (; insertionIndex < anchored.length; insertionIndex++) {
        const insertion = anchored[insertionIndex];
        normalized.push(insertionOf(index, insertion.position, insertion.text));
    }
    return normalized;
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
        const source = { kind: "modification" as const, index: modificationIdx };
        if (modification.type === "insert") {
            const position = textOffset(index, modification.pos);
            original(position);
            add(position, position, modification.text, source);
        }
        else {
            const from = textOffset(index, modification.range.start);
            const to = textOffset(index, modification.range.end);
            original(from);
            add(from, to, "", source);
            cursor = to;
        }
    });
    original(index.characters.length);
    return { text: pieces.map(piece => piece.text).join(""), length, pieces, modifications: normalized };
}

// from/to address displayed codepoints. Only removed original characters create new source deletions.
export function editText(index: TextIndex, projection: TextProjection, from: number, to: number, text: string): TextProjection {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from || to > projection.length) {
        throw new RangeError("Invalid rendered text range.");
    }
    if (Array.from(projection.text).slice(from, to).join("") === text) return projection;
    const modifications: Modification[] = [];
    let inserted = false;
    function insert(position: number, value: string): void {
        if (value) modifications.push(insertionOf(index, position, value));
    }
    function placeInsertion(piece: TextPiece): void {
        if (!inserted && piece.from <= from && from <= piece.to) {
            const position = piece.sourceFrom + (piece.source.kind === "segment" ? from - piece.from : 0);
            insert(position, text);
            inserted = true;
        }
    }
    for (const piece of projection.pieces) {
        if (piece.source.kind === "segment") {
            placeInsertion(piece);
            const start = Math.max(from, piece.from);
            const end = Math.min(to, piece.to);
            if (start < end) modifications.push(deletionOf(index, piece.sourceFrom + start - piece.from, piece.sourceFrom + end - piece.from));
            continue;
        }
        const modification = projection.modifications[piece.source.index];
        if (modification.type === "delete") {
            modifications.push(modification);
            placeInsertion(piece);
            continue;
        }
        const characters = Array.from(piece.text);
        const start = Math.max(0, Math.min(characters.length, from - piece.from));
        const end = Math.max(0, Math.min(characters.length, to - piece.from));
        insert(piece.sourceFrom, characters.slice(0, start).join(""));
        placeInsertion(piece);
        insert(piece.sourceFrom, characters.slice(end).join(""));
    }
    if (!inserted) insert(index.characters.length, text);
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