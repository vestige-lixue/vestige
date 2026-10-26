import { type Range } from "../../shared/util/range";
import { textPosition, textPieces, sourceTextPieces, projectedOffset, type TextPiece, type TextIndex, type TextProjection } from "../../shared/transcript/text";

export type TranscriptInformation = {
    key: string;
    kind: "token" | "deletion" | "gap";
    // UTF-16 offsets in the current displayed text, excluding editor node boundaries.
    from: number;
    to: number;
    sourceFrom: number;
    sourceTo: number;
    range: Range | null;
    original: string | null;
    probability: number | null;
    blankProbability: number | null;
    gaps?: TranscriptInformation[];
};

type SpeechInterval = { start: number; end: number; offset: number };
const speechIntervals = new WeakMap<TextIndex, { duration: number; intervals: SpeechInterval[] }>();

function intervalsOf(index: TextIndex, duration: number): SpeechInterval[] {
    const previous = speechIntervals.get(index);
    if (previous?.duration === duration) return previous.intervals;
    // A TextIndex describes one immutable Run; text edits only change its projection.
    const intervals = index.transcript.flatMap((segment, segmentIdx) => {
        const start = Math.max(0, segment.range.start);
        const end = Math.min(duration, segment.range.end);
        return segment.token.text && start < end ? [{ start, end, offset: index.starts[segmentIdx] }] : [];
    }).sort((a, b) => a.start - b.start || a.end - b.end);
    speechIntervals.set(index, { duration, intervals });
    return intervals;
}

const tokenCache = new WeakMap<TextProjection, Map<string, TranscriptInformation>>();
function pieceInformation(index: TextIndex, piece: TextPiece): TranscriptInformation {
    const segment = piece.source.kind === "segment" ? index.transcript[piece.source.index] : null;
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
    return {
        key: `${piece.source.kind}-${piece.source.index}`,
        kind: segment ? "token" : "deletion",
        from: piece.utf16From, to: piece.utf16To, range,
        sourceFrom: piece.sourceFrom, sourceTo: piece.sourceTo,
        original: segment ? null : index.characters.slice(piece.sourceFrom, piece.sourceTo).join(""),
        probability: segment?.token.prob ?? null,
        blankProbability: segment?.blankProb ?? null
    };
}

function tokens(index: TextIndex, projection: TextProjection, pieces: TextPiece[]): TranscriptInformation[] {
    let cache = tokenCache.get(projection);
    if (!cache) tokenCache.set(projection, cache = new Map());
    return pieces.filter(piece => piece.source.kind === "segment").map(piece => {
        const key = `${piece.source.index}/${piece.sourceFrom}/${piece.sourceTo}`;
        let item = cache.get(key);
        if (!item) {
            item = pieceInformation(index, piece); cache.set(key, item);
        }
        return item;
    });
}

export function transcriptTokens(index: TextIndex, projection: TextProjection, from: number, to = from): TranscriptInformation[] {
    return tokens(index, projection, textPieces(index, projection, from, to, true));
}

export function transcriptTokenGroup(index: TextIndex, projection: TextProjection, token: TranscriptInformation): TranscriptInformation[] {
    // Token keys refer to immutable Run indices, including when edits split one token into pieces.
    const segmentIdx = Number(token.key.slice("segment-".length));
    return tokens(index, projection, sourceTextPieces(index, projection, index.starts[segmentIdx], index.starts[segmentIdx + 1])
        .filter(piece => piece.source.kind === "segment" && piece.source.index === segmentIdx));
}

type Gap = { start: number; end: number; offset: number };
const gaps = new WeakMap<TextIndex, { duration: number; values: Gap[] }>();
function gapsOf(index: TextIndex, duration: number): Gap[] {
    const previous = gaps.get(index);
    if (previous?.duration === duration) return previous.values;
    const values: Gap[] = [];
    if (Number.isFinite(duration) && duration > 0) {
        let end = 0;
        for (const interval of intervalsOf(index, duration)) {
            if (interval.start > end) values.push({ start: end, end: interval.start, offset: interval.offset });
            end = Math.max(end, interval.end);
        }
        if (end < duration) values.push({ start: end, end: duration, offset: index.characters.length });
    }
    gaps.set(index, { duration, values });
    return values;
}

function gapInformation(index: TextIndex, projection: TextProjection, duration: number): TranscriptInformation[] {
    return gapsOf(index, duration).map(gap => {
        const from = projectedOffset(projection, gap.offset);
        return {
            key: `gap-${gap.start}-${gap.end}`, kind: "gap", from, to: from,
            sourceFrom: gap.offset, sourceTo: gap.offset,
            range: { start: gap.start, end: gap.end }, original: null, probability: null, blankProbability: null
        };
    });
}

export function transcriptEvents(index: TextIndex, projection: TextProjection, duration: number): TranscriptInformation[] {
    const result: TranscriptInformation[] = [];
    const deletions = new Map<number, TranscriptInformation>();
    projection.modifications.forEach((modification, modificationIdx) => {
        if (modification.type !== "delete") return;
        const sourceFrom = index.starts[modification.range.start.segmentIdx] + modification.range.start.offset;
        const sourceTo = index.starts[modification.range.end.segmentIdx] + modification.range.end.offset;
        const position = projectedOffset(projection, sourceFrom);
        const information = pieceInformation(index, {
            source: { kind: "modification", index: modificationIdx }, sourceFrom, sourceTo,
            from: 0, to: 0, utf16From: position, utf16To: position, text: ""
        });
        information.gaps = [];
        result.push(information);
        deletions.set(position, information);
    });
    for (const gap of gapInformation(index, projection, duration)) {
        const deletion = deletions.get(gap.from);
        if (deletion) deletion.gaps!.push(gap);
        else result.push(gap);
    }
    return result;
}

export function transcriptInformation(index: TextIndex, projection: TextProjection, duration: number): TranscriptInformation[] {
    return [
        ...tokens(index, projection, textPieces(index, projection)),
        ...transcriptEvents(index, projection, duration)
    ];
}

export type InspectionInformation = TranscriptInformation;