import { firstTrue } from "../util/search";
import { type Modification } from "../Vestige";
import { type TranscriptSpan } from "../transcription/Run";
import { type TextPosition } from "../util/range";
import { pieceTree, concatPieces, splitPieces, displayedPieces, sourcePieces, displayedOffset, convertOffset, type Piece, type PieceTree, type LocatedPiece } from "./pieces";

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
    utf16From: number;
    utf16To: number;
};

export type TextProjection = {
    text: string;
    length: number;
    tree: PieceTree | null;
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
    const segmentIdx = firstTrue(index.transcript.length, position => index.starts[position] > offset) - 1;
    return { segmentIdx, offset: offset - index.starts[segmentIdx] };
}

function deletionOf(index: TextIndex, from: number, to: number): Modification {
    return { type: "delete", range: { start: textPosition(index, from), end: textPosition(index, to) } };
}

function insertionOf(index: TextIndex, position: number, text: string): Modification {
    return { type: "insert", pos: textPosition(index, position), text };
}

// Greedy codepoint alignment with one-character lookahead; never search for distant matches.
function restoreReplacement(index: TextIndex, from: number, to: number, text: string, modifications: Modification[]): void {
    const characters = Array.from(text);
    let source = from;
    let inserted = 0;
    let deletedFrom = from;
    let insertedFrom = 0;
    function append(end: number, insertedEnd: number): void {
        if (deletedFrom < end) modifications.push(deletionOf(index, deletedFrom, end));
        if (insertedFrom < insertedEnd) modifications.push(insertionOf(index, end, characters.slice(insertedFrom, insertedEnd).join("")));
    }
    while (source < to && inserted < characters.length) {
        if (index.characters[source] === characters[inserted]) {
            append(source, inserted);
            deletedFrom = ++source;
            insertedFrom = ++inserted;
        }
        else if (source + 1 < to && inserted + 1 < characters.length && index.characters[source + 1] === characters[inserted + 1]) {
            // Prefer a substitution when the next pair already lines up.
            source++; inserted++;
        }
        else if (inserted + 1 < characters.length && index.characters[source] === characters[inserted + 1]) inserted++;
        else if (source + 1 < to && index.characters[source + 1] === characters[inserted]) source++;
        else {
            source++; inserted++;
        }
    }
    append(to, characters.length);
}

export function normalizeModifications(index: TextIndex, modifications: readonly Modification[], restore = true): Modification[] {
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
        const position = deletion && deletion.from <= insertion.position ? deletion.to : insertion.position;
        const previous = anchored.at(-1);
        if (previous && previous.position === position) previous.text += insertion.text;
        else anchored.push({ position, text: insertion.text });
    }
    const normalized: Modification[] = [];
    let insertionIndex = 0;
    for (const deletion of merged) {
        while (insertionIndex < anchored.length && anchored[insertionIndex].position < deletion.from) {
            const insertion = anchored[insertionIndex++];
            normalized.push(insertionOf(index, insertion.position, insertion.text));
        }
        const insertion = anchored[insertionIndex]?.position === deletion.to ? anchored[insertionIndex++] : null;
        if (insertion && restore) restoreReplacement(index, deletion.from, deletion.to, insertion.text, normalized);
        else {
            normalized.push(deletionOf(index, deletion.from, deletion.to));
            if (insertion) normalized.push(insertionOf(index, insertion.position, insertion.text));
        }
    }
    for (; insertionIndex < anchored.length; insertionIndex++) {
        const insertion = anchored[insertionIndex];
        normalized.push(insertionOf(index, insertion.position, insertion.text));
    }
    return normalized;
}

function modificationStart(index: TextIndex, modification: Modification): number {
    return textOffset(index, modification.type === "insert" ? modification.pos : modification.range.start);
}

function modificationEnd(index: TextIndex, modification: Modification): number {
    return textOffset(index, modification.type === "insert" ? modification.pos : modification.range.end);
}

function sourceWindow(index: TextIndex, modifications: readonly Modification[], from: number, to: number): PieceTree | null {
    const pieces: Piece[] = [];
    let cursor = from;
    function original(end: number): void {
        while (cursor < end) {
            const { segmentIdx } = textPosition(index, cursor);
            const next = Math.min(end, index.starts[segmentIdx + 1]);
            pieces.push({ kind: "segment", index: segmentIdx, sourceFrom: cursor, sourceTo: next, text: index.characters.slice(cursor, next).join("") });
            cursor = next;
        }
    }
    for (const modification of modifications) {
        const start = modificationStart(index, modification);
        if (start < from || start > to) continue;
        original(start);
        const end = modificationEnd(index, modification);
        pieces.push({ kind: modification.type, index: -1, sourceFrom: start, sourceTo: end, text: modification.type === "insert" ? modification.text : "" });
        cursor = end;
    }
    original(to);
    return pieceTree(pieces);
}

const modificationIndices = new WeakMap<TextProjection, Map<string, number>>();
function indicesOf(projection: TextProjection, index: TextIndex): Map<string, number> {
    let indices = modificationIndices.get(projection);
    if (!indices) {
        indices = new Map(projection.modifications.map((modification, position) => [`${modification.type}/${modificationStart(index, modification)}`, position]));
        modificationIndices.set(projection, indices);
    }
    return indices;
}

function located(index: TextIndex, projection: TextProjection, piece: LocatedPiece): TextPiece {
    return {
        from: piece.from, to: piece.to, sourceFrom: piece.sourceFrom, sourceTo: piece.sourceTo,
        utf16From: piece.utf16From, utf16To: piece.utf16To, text: piece.text,
        source: piece.kind === "segment" ? { kind: "segment", index: piece.index }
            : { kind: "modification", index: indicesOf(projection, index).get(`${piece.kind}/${piece.sourceFrom}`)! }
    };
}

export function textPieces(index: TextIndex, projection: TextProjection, from = 0, to = projection.length, utf16 = false): TextPiece[] {
    return Array.from(displayedPieces(projection.tree, from, to, utf16), piece => located(index, projection, piece));
}

export function sourceTextPieces(index: TextIndex, projection: TextProjection, from: number, to: number): TextPiece[] {
    return Array.from(sourcePieces(projection.tree, from, to), piece => located(index, projection, piece));
}

export function projectedOffset(projection: TextProjection, source: number): number {
    return displayedOffset(projection.tree, source);
}

export function projectionOffset(projection: TextProjection, offset: number, toUtf16: boolean): number {
    return convertOffset(projection.tree, offset, toUtf16);
}

export function projectText(index: TextIndex, modifications: readonly Modification[]): TextProjection {
    const normalized = normalizeModifications(index, modifications);
    const tree = sourceWindow(index, normalized, 0, index.characters.length);
    return { text: Array.from(displayedPieces(tree), piece => piece.text).join(""), length: tree?.length ?? 0, tree, modifications: normalized };
}

function sameModification(left: Modification, right: Modification): boolean {
    if (left.type !== right.type) return false;
    return left.type === "insert" && right.type === "insert"
        ? left.pos.segmentIdx === right.pos.segmentIdx && left.pos.offset === right.pos.offset && left.text === right.text
        : left.type === "delete" && right.type === "delete" && left.range.start.segmentIdx === right.range.start.segmentIdx
            && left.range.start.offset === right.range.start.offset && left.range.end.segmentIdx === right.range.end.segmentIdx && left.range.end.offset === right.range.end.offset;
}

// Source window whose pieces may differ between two normalized modification lists; pieces outside it are shared.
function changedWindow(index: TextIndex, previous: readonly Modification[], modifications: readonly Modification[]): [number, number] | null {
    let first = 0;
    while (first < previous.length && first < modifications.length && sameModification(previous[first], modifications[first])) first++;
    let oldEnd = previous.length;
    let newEnd = modifications.length;
    while (oldEnd > first && newEnd > first && sameModification(previous[oldEnd - 1], modifications[newEnd - 1])) {
        oldEnd--; newEnd--;
    }
    const changed = [...previous.slice(first, oldEnd), ...modifications.slice(first, newEnd)];
    if (!changed.length) return null;
    let from = Infinity;
    let to = -Infinity;
    for (const modification of changed) {
        from = Math.min(from, modificationStart(index, modification));
        to = Math.max(to, modificationEnd(index, modification));
    }
    // Boundary insertions belong to their deletion anchor, including its end. Keep that unit whole.
    let expanded = true;
    while (expanded) {
        expanded = false;
        for (const modification of [...previous, ...modifications]) {
            if (modification.type !== "delete") continue;
            const start = modificationStart(index, modification);
            const end = modificationEnd(index, modification);
            if (start <= to && end >= from && (start < from || end > to)) {
                from = Math.min(from, start);
                to = Math.max(to, end);
                expanded = true;
            }
        }
    }
    return [from, to];
}

function updateTree(index: TextIndex, projection: TextProjection, modifications: Modification[]): PieceTree | null {
    const window = changedWindow(index, projection.modifications, modifications);
    if (!window) return projection.tree;
    const [left] = splitPieces(projection.tree, window[0], false);
    const [, right] = splitPieces(projection.tree, window[1], true);
    return concatPieces(concatPieces(left, sourceWindow(index, modifications, window[0], window[1])), right);
}

// Displayed codepoint range of `after` outside which both projections have identical text and provenance.
// D18 can restore characters typed by earlier edits, so this may extend beyond the edited range.
export function provenanceChange(index: TextIndex, before: TextProjection, after: TextProjection): { from: number; to: number } | null {
    const window = changedWindow(index, before.modifications, after.modifications);
    if (!window) return null;
    const [left] = splitPieces(after.tree, window[0], false);
    const [, right] = splitPieces(after.tree, window[1], true);
    return { from: left?.length ?? 0, to: after.length - (right?.length ?? 0) };
}

// Reapply only the final IME replacement to its saved source identities, ignoring provisional candidates.
export function commitText(index: TextIndex, saved: TextProjection, pending: TextProjection): TextProjection {
    if (pending.text === saved.text) return saved;
    const before = provenanceChange(index, pending, saved)!;
    const after = provenanceChange(index, saved, pending)!;
    const original = Array.from(saved.text.slice(projectionOffset(saved, before.from, true), projectionOffset(saved, before.to, true)));
    const inserted = Array.from(pending.text.slice(projectionOffset(pending, after.from, true), projectionOffset(pending, after.to, true)));
    let first = 0;
    let oldEnd = original.length;
    let newEnd = inserted.length;
    while (first < oldEnd && first < newEnd && original[first] === inserted[first]) first++;
    while (oldEnd > first && newEnd > first && original[oldEnd - 1] === inserted[newEnd - 1]) {
        oldEnd--; newEnd--;
    }
    return editText(index, saved, before.from + first, before.from + oldEnd, inserted.slice(first, newEnd).join(""));
}

// from/to address displayed codepoints. IME updates defer restoration until their final commit.
export function editText(index: TextIndex, projection: TextProjection, from: number, to: number, text: string, restore = true): TextProjection {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from || to > projection.length) {
        throw new RangeError("Invalid rendered text range.");
    }
    const utf16From = projectionOffset(projection, from, true);
    const utf16To = projectionOffset(projection, to, true);
    if (projection.text.slice(utf16From, utf16To) === text) return projection;
    const pieces = textPieces(index, projection, from, to);
    const touched = new Set(pieces.flatMap(piece => piece.source.kind === "modification" ? [piece.source.index] : []));
    const remaining = projection.modifications.filter((_, position) => !touched.has(position));
    const start = pieces[0]?.sourceFrom ?? index.characters.length;
    const modifications = remaining.filter(modification => modificationStart(index, modification) < start);
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
    for (const piece of pieces) {
        if (piece.source.kind === "segment") {
            placeInsertion(piece);
            const first = Math.max(from, piece.from);
            const end = Math.min(to, piece.to);
            if (first < end) modifications.push(deletionOf(index, piece.sourceFrom + first - piece.from, piece.sourceFrom + end - piece.from));
            continue;
        }
        const modification = projection.modifications[piece.source.index];
        if (modification.type === "delete") {
            modifications.push(modification);
            placeInsertion(piece);
            continue;
        }
        const characters = Array.from(piece.text);
        const first = Math.max(0, Math.min(characters.length, from - piece.from));
        const end = Math.max(0, Math.min(characters.length, to - piece.from));
        insert(piece.sourceFrom, characters.slice(0, first).join(""));
        placeInsertion(piece);
        insert(piece.sourceFrom, characters.slice(end).join(""));
    }
    if (!inserted) insert(index.characters.length, text);
    for (const modification of remaining) {
        if (modificationStart(index, modification) >= start) modifications.push(modification);
    }
    const normalized = normalizeModifications(index, modifications, restore);
    const tree = updateTree(index, projection, normalized);
    return { text: projection.text.slice(0, utf16From) + text + projection.text.slice(utf16To), length: tree?.length ?? 0, tree, modifications: normalized };
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