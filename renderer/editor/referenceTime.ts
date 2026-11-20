import { displayedPieces, type PieceTree } from "../../shared/transcript/pieces";
import { projectedOffset, type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { orderedTokenTimes } from "../../shared/transcript/timing";
import { firstTrue } from "../../shared/util/search";
import { type Range } from "../../shared/util/range";

type TokenBounds = { from: number; to: number; start: number; end: number; segmentIdx: number };
type TimeIndex = {
    prepare: (tree: PieceTree | null) => boolean;
    timeAt: (tree: PieceTree | null, offset: number) => number | undefined;
    rangeAtTime: (projection: TextProjection, range: Range) => { from: number; to: number } | null;
    offsetAtTime: (projection: TextProjection, time: number) => number | undefined;
};
const timeIndexes = new WeakMap<TextIndex, { duration: number; times: TimeIndex }>();

function nearest<T>(ordered: readonly T[], time: number, timestamp: (item: T) => number): T | undefined {
    const i = firstTrue(ordered.length, i => timestamp(ordered[i]) >= time);
    const before = ordered[i - 1], after = ordered[i];
    return before && (!after || time - timestamp(before) < timestamp(after) - time) ? before : after;
}

export function referenceTimeIndex(index: TextIndex, duration: number): TimeIndex {
    const cached = timeIndexes.get(index);
    if (cached?.duration === duration) return cached.times;
    const starts: (number | undefined)[] = [];
    const ordered: { time: number; segmentIdx: number }[] = [];
    for (const { start, end, segmentIdx } of orderedTokenTimes(index)) {
        if (duration <= 0 || start >= duration || start < 0 && end <= 0 || index.starts[segmentIdx] === index.starts[segmentIdx + 1]) continue;
        const time = Math.max(0, start);
        starts[segmentIdx] = time;
        ordered.push({ time, segmentIdx });
    }
    const reachable = new WeakMap<PieceTree, boolean>();

    // Edits share the unmodified subtrees. Index new branches before scrolling so even an
    // entire screen of additions, deletions or invalid timestamps costs only a tree descent.
    function prepare(tree: PieceTree | null): boolean {
        if (!tree) return false;
        const cached = reachable.get(tree);
        if (cached !== undefined) return cached;
        let found;
        if ("left" in tree) {
            const left = prepare(tree.left), right = prepare(tree.right);
            found = left || right;
        }
        else found = tree.kind === "segment" && starts[tree.index] !== undefined;
        reachable.set(tree, found);
        return found;
    }

    type Neighbor = { segmentIdx: number; distance: number };
    function neighbor(tree: PieceTree | null, offset: number, before: boolean): Neighbor | null {
        if (!tree || !reachable.get(tree) || (before ? offset <= 0 : offset >= tree.width)) return null;
        if (!("left" in tree)) return { segmentIdx: tree.index, distance: Math.max(0, -offset, offset - tree.width) };
        const rightOffset = offset - tree.left.width;
        return before ? neighbor(tree.right, rightOffset, true) ?? neighbor(tree.left, offset, true)
            : neighbor(tree.left, offset, false) ?? neighbor(tree.right, rightOffset, false);
    }

    // A selection needs visible text at both ends. Cache the surviving UTF-16 bounds of each
    // original token, including tokens split by insertions. A wholly deleted token has no bounds.
    const visibleTimes = new WeakMap<TextProjection, { starts: TokenBounds[]; ends: TokenBounds[] }>();
    function visibleTokens(projection: TextProjection): { starts: TokenBounds[]; ends: TokenBounds[] } {
        let visible = visibleTimes.get(projection);
        if (!visible) {
            const bounds = new Map<number, TokenBounds>();
            for (const piece of displayedPieces(projection.tree)) {
                const start = starts[piece.index];
                if (piece.kind !== "segment" || start === undefined) continue;
                const existing = bounds.get(piece.index);
                if (existing) existing.to = piece.utf16To;
                else bounds.set(piece.index, { from: piece.utf16From, to: piece.utf16To, start,
                    end: Math.min(duration, index.transcript[piece.index].range.end), segmentIdx: piece.index });
            }
            const byStart = [...bounds.values()].sort((a, b) => a.start - b.start);
            visible = { starts: byStart, ends: byStart.toSorted((a, b) => a.end - b.end || b.segmentIdx - a.segmentIdx) };
            visibleTimes.set(projection, visible);
        }
        return visible;
    }

    const times: TimeIndex = {
        prepare,
        timeAt(tree: PieceTree | null, offset: number): number | undefined {
            const after = neighbor(tree, offset, false), before = neighbor(tree, offset, true);
            const nearest = before && (!after || before.distance < after.distance) ? before : after;
            return nearest ? starts[nearest.segmentIdx] : undefined;
        },
        rangeAtTime(projection, range) {
            const visible = visibleTokens(projection);
            const start = nearest(visible.starts, range.start, token => token.start);
            const end = nearest(visible.ends, range.end, token => token.end);
            return start && end ? { from: start.from, to: end.segmentIdx < start.segmentIdx ? start.to : end.to } : null;
        },
        offsetAtTime(projection: TextProjection, time: number): number | undefined {
            const token = nearest(ordered, time, token => token.time);
            if (!token) return undefined;
            const offset = projectedOffset(projection, index.starts[token.segmentIdx]);
            // A partially replaced token may resume after many added lines. A completely
            // deleted token is represented by its deletion marker at the projected offset.
            const visible = neighbor(projection.tree, offset, false);
            return visible?.segmentIdx === token.segmentIdx ? offset + visible.distance : offset;
        }
    };
    timeIndexes.set(index, { duration, times });
    return times;
}