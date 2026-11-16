import { type SrtOptions } from "../export";
import { timeEnvelope, mergeEnvelopes, type TimedText, type TimeEnvelope } from "./timing";
import { lineWidth, type TextLayout, type TextRange } from "./breaks";
import { addLine } from "./lines";

function durationOf(envelope: TimeEnvelope): number {
    const range = envelope.intervals ?? envelope.points;
    return range ? range.end - range.start : 0;
}

function preferredBreak(times: readonly TimeEnvelope[], layout: TextLayout, from: number, to: number, options: SrtOptions): number {
    let best = to, rank = Infinity;
    let envelope: TimeEnvelope = { intervals: null, points: null };
    for (let cut = from + 1; cut <= to; cut++) {
        envelope = mergeEnvelopes(envelope, times[cut - 1]);
        const fill = Math.max(options.maxLineWidth === null ? 0 : lineWidth(layout, from, cut) / (options.maxLineWidth * options.maxLines),
            options.maxDurationSeconds === null ? 0 : durationOf(envelope) / options.maxDurationSeconds);
        const boundary = layout.boundaries[cut - 1];
        const priority = fill >= 1 / 3 && boundary === "sentence" ? 0 : fill >= 1 / 3 && boundary === "clause" ? 1 : 2;
        if (priority <= rank) {
            best = cut; rank = priority;
        }
    }
    return best;
}

export function cueRanges(timed: TimedText, layout: TextLayout, options: SrtOptions): TextRange[] {
    const pauses = new Set(options.pauseSeconds === null ? [] : timed.pauses.filter(pause => pause.length >= options.pauseSeconds!).map(pause => pause.offset));
    // Keep both kinds of envelope: a later interval supersedes every accumulated point.
    const times = layout.lineBreaks.map((_, i) => timeEnvelope(timed, layout.offsets[i], layout.offsets[i + 1]));
    const cues: TextRange[] = [];
    let from = 0, next = 0;
    let lines: TextRange[] = [];
    let envelope: TimeEnvelope = { intervals: null, points: null };
    function emit(to: number): void {
        if (lineWidth(layout, from, to) > 0) cues.push({ from, to });
        from = to;
        lines = []; envelope = { intervals: null, points: null };
    }
    function rebuild(to: number): void {
        for (let i = from; i < to; i++) {
            lines = addLine(layout, lines, i, options.maxLineWidth);
            envelope = mergeEnvelopes(envelope, times[i]);
        }
    }
    while (next + 1 < layout.offsets.length) {
        if (next > from && (options.splitAtLineBreaks && layout.lineBreaks[next - 1] || pauses.has(layout.offsets[next])
            || options.splitAtSentenceEnds && layout.boundaries[next - 1] === "sentence")) emit(next);
        const nextEnvelope = mergeEnvelopes(envelope, times[next]);
        const previousLength = durationOf(envelope), nextLength = durationOf(nextEnvelope);
        const nextLines = addLine(layout, lines, next, options.maxLineWidth);
        const fits = nextLines.filter(line => lineWidth(layout, line.from, line.to) > 0).length <= options.maxLines
            && !(options.maxDurationSeconds !== null && nextLength > options.maxDurationSeconds && nextLength > previousLength);
        if (next > from && !fits) {
            emit(preferredBreak(times, layout, from, next, options));
            rebuild(next);
            continue;
        }
        lines = nextLines; envelope = nextEnvelope;
        next++;
    }
    if (next > from) emit(next);
    return cues;
}