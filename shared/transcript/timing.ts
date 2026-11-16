import { type TextIndex } from "./text";

export type SpeechInterval = { start: number; end: number; offset: number };
const speechIntervals = new WeakMap<TextIndex, { duration: number; intervals: SpeechInterval[] }>();

export function intervalsOf(index: TextIndex, duration: number): SpeechInterval[] {
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

export type Gap = { start: number; end: number; offset: number };
const gaps = new WeakMap<TextIndex, { duration: number; values: Gap[] }>();
export function gapsOf(index: TextIndex, duration: number): Gap[] {
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