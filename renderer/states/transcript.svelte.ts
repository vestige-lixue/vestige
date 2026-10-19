import { type Run } from "../../shared/transcription/Run";
import * as project from "./project.svelte";
import * as mediaSelection from "./mediaSelection.svelte";

type Interval = { index: number; start: number; end: number };
type IntervalNode = Interval & { maxEnd: number; left: IntervalNode | null; right: IntervalNode | null };

const vestige = $derived(project.getVestige(mediaSelection.get()));
const run = $derived(vestige?.runs[vestige.displayedRunIdx]);
const duration = $derived(vestige?.media.duration ?? 0);
// Playback indexes exclude unreachable times without changing stored timestamps.
const wordStarts = $derived([...new Set(run?.transcript.filter(segment => segment.token.text.trim()
    && segment.range.start >= 0 && segment.range.start < duration).map(segment => segment.range.start) ?? [])].sort((a, b) => a - b));
const intervals = $derived.by(() => {
    const ranges = run?.transcript.map((segment, index) => ({ index, start: Math.max(0, segment.range.start), end: Math.min(duration, segment.range.end) }))
        .filter(range => range.start < range.end).sort((a, b) => a.start - b.start) ?? [];
    return buildIntervals(ranges, 0, ranges.length);
});

function buildIntervals(ranges: Interval[], start: number, end: number): IntervalNode | null {
    if (start >= end) return null;
    const middle = Math.floor((start + end) / 2);
    const range = ranges[middle];
    const left = buildIntervals(ranges, start, middle);
    const right = buildIntervals(ranges, middle + 1, end);
    return { ...range, maxEnd: Math.max(range.end, left?.maxEnd ?? -Infinity, right?.maxEnd ?? -Infinity), left, right };
}

export function getRun(): Run | undefined {
    return run;
}

export function getWordStarts(): readonly number[] {
    return wordStarts;
}

export function getWordIndex(time: number): number {
    const starts = wordStarts;
    const boundary = time + 0.001;
    let start = 0;
    let end = starts.length;
    while (start < end) {
        const middle = Math.floor((start + end) / 2);
        if (starts[middle] <= boundary) start = middle + 1;
        else end = middle;
    }
    return start - 1;
}

export function getWordPosition(time: number, direction: -1 | 1, fromIndex = getWordIndex(time)): number | null {
    // An explicit index keeps repeated navigation independent of playback progress.
    return wordStarts[fromIndex + direction] ?? null;
}

export function getActiveSegments(time: number): number[] {
    const active: number[] = [];
    function visit(node: IntervalNode | null): void {
        if (!node || node.maxEnd <= time) return;
        visit(node.left);
        if (node.start > time) return;
        if (time < node.end) active.push(node.index);
        visit(node.right);
    }
    visit(intervals);
    return active;
}