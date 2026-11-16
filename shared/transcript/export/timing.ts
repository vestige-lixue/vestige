import { type Range } from "../../util/range";
import { textPieces, textOffset, projectedOffset, type TextIndex, type TextProjection } from "../text";
import { gapsOf } from "../timing";
import { characterWidth } from "../width";

export type TimedText = {
    text: string;
    start: Float64Array;
    end: Float64Array;
    group: Int32Array;
    pauses: { offset: number; length: number }[];
    unanchored: number;
};

export type TimeEnvelope = { intervals: Range | null; points: Range | null };

function mergeRanges(left: Range | null, right: Range | null): Range | null {
    if (!left) return right;
    if (!right) return left;
    return { start: Math.min(left.start, right.start), end: Math.max(left.end, right.end) };
}

export function mergeEnvelopes(left: TimeEnvelope, right: TimeEnvelope): TimeEnvelope {
    return { intervals: mergeRanges(left.intervals, right.intervals), points: mergeRanges(left.points, right.points) };
}

export function timeEnvelope(timed: Pick<TimedText, "start" | "end">, from: number, to: number): TimeEnvelope {
    let intervals: Range | null = null, points: Range | null = null;
    for (let i = from; i < to; i++) {
        const start = timed.start[i], end = timed.end[i];
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        if (end > start) intervals = mergeRanges(intervals, { start, end });
        else points = mergeRanges(points, { start, end });
    }
    return { intervals, points };
}

// Points contribute only when no positive interval exists (as in the inspector).
export function timeRange(timed: Pick<TimedText, "start" | "end">, from: number, to: number): Range | null {
    const range = timeEnvelope(timed, from, to);
    return range.intervals ?? range.points;
}

function interpolate(characters: readonly string[], range: Range, assign: (i: number, start: number, end: number) => void): void {
    const widths = characters.map(character => /[\p{White_Space}\p{P}]/u.test(character) ? 0 : characterWidth(character.codePointAt(0)!));
    const total = widths.reduce((sum, width) => sum + width, 0);
    if (total === 0) {
        // An all-punctuation or all-whitespace group retains its original audio interval.
        for (let i = 0; i < characters.length; i++) assign(i, range.start, range.end);
        return;
    }
    let width = 0, start = range.start;
    for (let i = 0; i < characters.length; i++) {
        width += widths[i];
        const end = width === total ? range.end : range.start + (range.end - range.start) * width / total;
        assign(i, start, end);
        start = end;
    }
}

export function timeText(index: TextIndex, projection: TextProjection, duration: number): TimedText {
    const source = { start: new Float64Array(index.characters.length).fill(NaN), end: new Float64Array(index.characters.length).fill(NaN) };
    const groups = new Int32Array(index.characters.length).fill(-1);
    let nextGroup = 0;
    for (let from = 0; from < index.transcript.length;) {
        const range = index.transcript[from].range;
        let to = from + 1;
        if (range.end > range.start) {
            while (to < index.transcript.length && index.transcript[to].range.start === range.start && index.transcript[to].range.end === range.end) to++;
            const group = nextGroup++;
            interpolate(index.characters.slice(index.starts[from], index.starts[to]), range, (i, start, end) => {
                const offset = index.starts[from] + i;
                if (/[\r\n]/u.test(index.characters[offset])) return;
                source.start[offset] = start; source.end[offset] = end; groups[offset] = group;
            });
        }
        else {
            for (let i = index.starts[from]; i < index.starts[to]; i++) {
                const group = nextGroup++;
                if (/[\r\n]/u.test(index.characters[i])) continue;
                source.start[i] = range.start; source.end[i] = range.start; groups[i] = group;
            }
        }
        from = to;
    }
    const gaps = gapsOf(index, duration);
    const gapRanges = new Map(gaps.map(gap => [gap.offset, gap]));
    const replacements = new Map<number, Range>();
    for (const modification of projection.modifications) {
        if (modification.type !== "delete") continue;
        const from = textOffset(index, modification.range.start), to = textOffset(index, modification.range.end);
        const range = timeRange(source, from, to);
        if (range) replacements.set(to, range);
    }
    const timed: TimedText = {
        text: projection.text, start: new Float64Array(projection.text.length).fill(NaN), end: new Float64Array(projection.text.length).fill(NaN),
        group: new Int32Array(projection.text.length).fill(-1),
        pauses: gaps.map(gap => ({ offset: projectedOffset(projection, gap.offset), length: gap.end - gap.start })), unanchored: 0
    };
    function assign(offset: number, character: string, start: number, end: number, group: number): void {
        if (/[\r\n]/u.test(character)) return;
        for (let i = offset; i < offset + character.length; i++) {
            timed.start[i] = start; timed.end[i] = end; timed.group[i] = group;
        }
    }
    const unattached: { from: number; text: string; forward: boolean }[] = [];
    for (const piece of textPieces(index, projection)) {
        let offset = piece.utf16From;
        if (piece.source.kind === "segment") {
            let original = piece.sourceFrom;
            for (const character of piece.text) {
                assign(offset, character, source.start[original], source.end[original], groups[original]);
                offset += character.length; original++;
            }
        }
        else {
            const range = replacements.get(piece.sourceFrom) ?? gapRanges.get(piece.sourceFrom);
            if (range) {
                const group = nextGroup++;
                const characters = Array.from(piece.text);
                interpolate(characters, range, (i, start, end) => {
                    const character = characters[i];
                    assign(offset, character, start, end, group);
                    offset += character.length;
                });
            }
            else {
                unattached.push({ from: offset, text: piece.text, forward: offset === 0 || /[\r\n]/u.test(timed.text[offset - 1]) });
                if (/[^\r\n]/u.test(piece.text)) timed.unanchored++;
            }
        }
    }
    function attach(piece: typeof unattached[number], anchor: number, end: boolean): void {
        const time = anchor < 0 ? 0 : end ? timed.end[anchor] : timed.start[anchor];
        const group = anchor < 0 ? -1 : timed.group[anchor];
        let offset = piece.from;
        for (const character of piece.text) {
            assign(offset, character, time, time, group);
            offset += character.length;
        }
    }
    for (const piece of unattached) {
        if (piece.forward) continue;
        let anchor = piece.from - 1;
        while (anchor >= 0 && !Number.isFinite(timed.end[anchor])) anchor--;
        attach(piece, anchor, true);
    }
    for (let i = unattached.length - 1; i >= 0; i--) {
        const piece = unattached[i];
        if (!piece.forward) continue;
        let anchor = piece.from + piece.text.length;
        while (anchor < timed.text.length && !Number.isFinite(timed.start[anchor])) anchor++;
        if (anchor < timed.text.length) attach(piece, anchor, false);
        else {
            anchor = piece.from - 1;
            while (anchor >= 0 && !Number.isFinite(timed.end[anchor])) anchor--;
            attach(piece, anchor, true);
        }
    }
    return timed;
}