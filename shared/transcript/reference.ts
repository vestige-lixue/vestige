import { type Run, type TranscriptSpan } from "../transcription/Run";
import { commonRuns, type CommonRun } from "../util/diff";
import { type Range } from "../util/range";
import { firstTrue } from "../util/search";
import { displayedPieces } from "./pieces";
import { createTextIndex, projectText, projectionSlice, type TextIndex, type TextProjection, type TextSpan } from "./text";

export type ReferenceCandidate = { text: string; range: Range; tokens: number[] };
type Entry = { token: number; span: TranscriptSpan; end: number };
const indexes = new WeakMap<readonly TranscriptSpan[], Entry[]>();

function indexOf(transcript: readonly TranscriptSpan[]): Entry[] {
    let entries = indexes.get(transcript);
    if (entries) return entries;
    entries = transcript.map((span, token) => ({ token, span, end: 0 })).sort((a, b) => a.span.range.start - b.span.range.start || a.token - b.token);
    let end = 0;
    for (const entry of entries) entry.end = end = Math.max(end, entry.span.range.end);
    indexes.set(transcript, entries);
    return entries;
}

export function referenceCandidate(source: Pick<TextIndex, "transcript">, target: Range, threshold: number): ReferenceCandidate | null {
    const entries = indexOf(source.transcript);
    const from = firstTrue(entries.length, i => entries[i].end >= target.start);
    const to = firstTrue(entries.length, i => entries[i].span.range.start > target.end);
    const included = entries.slice(from, to).filter(({ span }) => {
        if (!span.token.text) return false;
        const { start, end } = span.range;
        if (start === end) return target.start <= start && start <= target.end;
        if (target.start === target.end) return start <= target.start && target.start <= end;
        const overlap = Math.min(end, target.end) - Math.max(start, target.start);
        // Zero percent still requires overlap; subtraction of decimal timestamps can round a boundary down.
        const tolerance = Number.EPSILON * Math.max(1, end, target.end) * 4;
        return overlap > 0 && overlap + tolerance >= Math.min(end - start, target.end - target.start) * threshold / 100;
    }).sort((a, b) => a.token - b.token);
    if (!included.length) return null;
    const range = { start: Infinity, end: -Infinity };
    for (const { span } of included) {
        range.start = Math.min(range.start, span.range.start);
        range.end = Math.max(range.end, span.range.end);
    }
    return {
        text: included.map(item => item.span.token.text).join(""),
        range,
        tokens: included.map(item => item.token)
    };
}

export type ReferencePane = { index: TextIndex; projection: TextProjection };
const referencePanes = new WeakMap<Run, ReferencePane>();

export function referencePane(run: Run): ReferencePane {
    let pane = referencePanes.get(run);
    if (!pane) {
        const index = createTextIndex(run.transcript);
        pane = { index, projection: projectText(index, []) };
        referencePanes.set(run, pane);
    }
    return pane;
}

const initialWindowSeconds = 10;
const minAnchorLength = 3;
const maxWindowCodepoints = 16384;
const maxEditDistance = 2048;

type AlignmentLimits = { codepoints?: number; editDistance?: number };
type Correspondence = { source: TextSpan; target: TextSpan };
type RangeMatch = Correspondence & { differences: Correspondence[] };
type Window = TextSpan & { points: Int32Array };
type Alignment = { source: Window; target: Window; anchors: CommonRun[]; atEnd: boolean };
const projectedTokens = new WeakMap<TextProjection, Map<number, TextSpan>>();

function visibleTokenBounds(projection: TextProjection): Map<number, TextSpan> {
    let bounds = projectedTokens.get(projection);
    if (!bounds) {
        bounds = new Map();
        for (const piece of displayedPieces(projection.tree)) {
            if (piece.kind !== "segment") continue;
            const previous = bounds.get(piece.index);
            if (previous) previous.to = piece.to;
            else bounds.set(piece.index, { from: piece.from, to: piece.to });
        }
        projectedTokens.set(projection, bounds);
    }
    return bounds;
}

function neighboringTime({ index, projection }: ReferencePane, selection: TextSpan): Range | null {
    let before: Range | undefined, after: Range | undefined;
    for (const [token, bounds] of visibleTokenBounds(projection)) {
        const range = index.transcript[token].range;
        if (bounds.from < selection.from) before = range;
        if (bounds.to > selection.to) {
            after = range;
            break;
        }
    }
    return before && after ? { start: Math.min(before.start, after.start), end: Math.max(before.end, after.end) } : before ?? after ?? null;
}

function timeWindow({ index, projection }: ReferencePane, start: number, end: number, query?: TextSpan): { span: TextSpan | null; complete: boolean } {
    const entries = indexOf(index.transcript), bounds = visibleTokenBounds(projection);
    const first = firstTrue(entries.length, i => entries[i].end >= start);
    let from = query?.from ?? (projection.length ? Infinity : 0), to = query?.to ?? (projection.length ? -Infinity : 0);
    for (let i = first; i < entries.length && entries[i].span.range.start <= end; i++) {
        const { span, token } = entries[i];
        const visible = bounds.get(token);
        if (!visible || span.range.end < start) continue;
        from = Math.min(from, visible.from);
        to = Math.max(to, visible.to);
    }
    const complete = !entries.length || start <= entries[0].span.range.start && end >= entries[entries.length - 1].end;
    return { span: from <= to ? { from, to } : null, complete };
}

function windowedMatch<Result>(source: ReferencePane, target: ReferencePane, query: TextSpan, time: Range, limits: AlignmentLimits,
    match: (alignment: Alignment) => Result | undefined): Result | null {
    const maximum = limits.codepoints ?? maxWindowCodepoints;
    if (query.to - query.from > maximum) return null;
    for (let radius = initialWindowSeconds; ; radius *= 2) {
        const start = time.start - radius, end = time.end + radius;
        const { span: a, complete: sourceComplete } = timeWindow(source, start, end, query);
        const { span: b, complete: targetComplete } = timeWindow(target, start, end);
        if (a && a.to - a.from > maximum || b && b.to - b.from > maximum) return null;
        if (a && b) {
            const aPoints = Int32Array.from(projectionSlice(source.projection, a), character => character.codePointAt(0)!);
            const bPoints = Int32Array.from(projectionSlice(target.projection, b), character => character.codePointAt(0)!);
            // Joined text can pair surrogate halves from different pieces. Its offsets would not match the projection.
            if (aPoints.length !== a.to - a.from || bPoints.length !== b.to - b.from) return null;
            const runs = commonRuns(aPoints, bPoints, limits.editDistance ?? maxEditDistance);
            if (!runs) return null;
            const anchors = runs.filter(run => run.length >= minAnchorLength).map(run => ({ a: run.a + a.from, b: run.b + b.from, length: run.length }));
            const atStart = a.from === 0 && b.from === 0;
            const atEnd = a.to === source.projection.length && b.to === target.projection.length;
            if (atStart) anchors.unshift({ a: 0, b: 0, length: 0 });
            if (atEnd) anchors.push({ a: a.to, b: b.to, length: 0 });
            const result = match({ source: { ...a, points: aPoints }, target: { ...b, points: bPoints }, anchors, atEnd });
            if (result !== undefined) return result;
            if (atStart && atEnd) return null;
        }
        // Leading and trailing additions can leave a window short of a document edge even after all times are covered.
        if (sourceComplete && targetComplete) return null;
    }
}

function differenceBetween({ source, target }: Alignment, before: CommonRun, after: CommonRun): Correspondence | null {
    let from = before.a + before.length, to = after.a;
    let targetFrom = before.b + before.length, targetTo = after.b;
    const equal = (a: number, b: number): boolean => source.points[a - source.from] === target.points[b - target.from];
    // Keep equal text against a shared document edge, even if it is too short to use as an anchor.
    while (from < to && targetFrom < targetTo && equal(from, targetFrom)) {
        from++;
        targetFrom++;
    }
    while (from < to && targetFrom < targetTo && equal(to - 1, targetTo - 1)) {
        to--;
        targetTo--;
    }
    return from < to || targetFrom < targetTo ? { source: { from, to }, target: { from: targetFrom, to: targetTo } } : null;
}

export function matchReferenceRange(source: ReferencePane, target: ReferencePane, selection: TextSpan, range: Range | null, limits: AlignmentLimits = {}): RangeMatch | null {
    if (selection.from >= selection.to) return null;
    const time = range ?? neighboringTime(source, selection);
    if (!time) return null;
    return windowedMatch(source, target, selection, time, limits, alignment => {
        const { anchors } = alignment;
        // At a shared source boundary, the left endpoint uses the next anchor and the right uses the previous one.
        const first = firstTrue(anchors.length, i => anchors[i].a > selection.from) - 1;
        const last = firstTrue(anchors.length, i => anchors[i].a + anchors[i].length >= selection.to);
        if (first < 0 || last === anchors.length) return undefined;
        const left = anchors[first], right = anchors[last];
        const start = Math.min(selection.from - left.a, left.length), end = Math.max(0, selection.to - right.a);
        if (left.b + start > right.b + end) return null;
        const differences: Correspondence[] = [];
        for (let i = first; i < last; i++) {
            const difference = differenceBetween(alignment, anchors[i], anchors[i + 1]);
            if (difference) differences.push(difference);
        }
        return { source: { from: left.a + start, to: right.a + end }, target: { from: left.b + start, to: right.b + end }, differences };
    });
}

// False means the position was aligned and has no corresponding text. Null means alignment failed.
export function matchReferencePosition(source: ReferencePane, target: ReferencePane, position: number, time: Range, limits: AlignmentLimits = {}): TextSpan | false | null {
    return windowedMatch(source, target, { from: position, to: position }, time, limits, alignment => {
        const { anchors, atEnd } = alignment;
        const i = firstTrue(anchors.length - Number(atEnd), i => anchors[i].a + anchors[i].length > position);
        const before = anchors[i - 1], after = anchors[i];
        if (after && after.a < position) return false;
        if (!before || !after) return undefined;
        const difference = differenceBetween(alignment, before, after);
        return difference && difference.source.from === position && difference.source.to === position ? difference.target : false;
    });
}