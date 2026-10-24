import { type Range } from "../../shared/util/range";
import { codepointToUtf16, textPosition, type TextIndex, type TextProjection } from "../../shared/transcript/text";

export type TranscriptInformation = {
    key: string;
    kind: "token" | "deletion" | "gap";
    // UTF-16 offsets in the current displayed text, excluding editor node boundaries.
    from: number;
    to: number;
    range: Range | null;
    original: string | null;
    probability: number | null;
    blankProbability: number | null;
};

export function transcriptInformation(index: TextIndex, projection: TextProjection, duration: number): TranscriptInformation[] {
    const result: TranscriptInformation[] = [];
    const positions: number[] = [];
    let position = 0;
    for (const piece of projection.pieces) {
        positions.push(position);
        const from = position;
        position += piece.text.length;
        const segment = piece.source.kind === "segment" ? index.transcript[piece.source.index] : null;
        // Insertions have no source audio; their separate deletion piece keeps the original marker.
        if (piece.source.kind === "modification" && projection.modifications[piece.source.index].type === "insert") continue;
        let range: Range | null = segment?.range ?? null;
        if (!segment && piece.sourceFrom < piece.sourceTo) {
            const first = textPosition(index, piece.sourceFrom).segmentIdx;
            const last = textPosition(index, piece.sourceTo - 1).segmentIdx;
            range = { ...index.transcript[first].range };
            for (let segmentIdx = first + 1; segmentIdx <= last; segmentIdx++) {
                range.start = Math.min(range.start, index.transcript[segmentIdx].range.start);
                range.end = Math.max(range.end, index.transcript[segmentIdx].range.end);
            }
        }
        result.push({
            key: `${piece.source.kind}-${piece.source.index}`,
            kind: segment ? "token" : "deletion",
            from, to: position, range,
            original: segment ? null : index.characters.slice(piece.sourceFrom, piece.sourceTo).join(""),
            probability: segment?.token.prob ?? null,
            blankProbability: segment?.blankProb ?? null
        });
    }

    function projectedPosition(offset: number): number {
        let low = 0;
        let high = projection.pieces.length;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (projection.pieces[middle].sourceTo <= offset) low = middle + 1;
            else high = middle;
        }
        const piece = projection.pieces[low];
        if (!piece) return position;
        // A deleted source boundary stays at the deletion marker, after additions at its anchor.
        const characters = piece.source.kind === "segment" ? offset - piece.sourceFrom : 0;
        return positions[low] + codepointToUtf16(piece.text, characters);
    }

    if (!Number.isFinite(duration) || duration <= 0) return result;
    const intervals = index.transcript.flatMap((segment, segmentIdx) => {
        const start = Math.max(0, segment.range.start);
        const end = Math.min(duration, segment.range.end);
        return segment.token.text && start < end ? [{ start, end, offset: index.starts[segmentIdx] }] : [];
    }).sort((a, b) => a.start - b.start || a.end - b.end);
    let end = 0;
    function gap(start: number, end: number, offset: number): void {
        const from = projectedPosition(offset);
        result.push({
            key: `gap-${start}-${end}`, kind: "gap", from, to: from,
            range: { start, end }, original: null, probability: null, blankProbability: null
        });
    }
    for (const interval of intervals) {
        if (interval.start > end) gap(end, interval.start, interval.offset);
        end = Math.max(end, interval.end);
    }
    if (end < duration) gap(end, duration, index.characters.length);
    return result;
}