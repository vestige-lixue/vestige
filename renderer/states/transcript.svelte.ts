import { type Run } from "../../shared/transcription/Run";
import * as project from "./project.svelte";
import * as mediaSelection from "./mediaSelection.svelte";

type Interval = { index: number; start: number; end: number };
type IntervalNode = Interval & { maxEnd: number; left: IntervalNode | null; right: IntervalNode | null };

const run = $derived.by(() => {
    const vestige = project.getVestige(mediaSelection.get());
    return vestige?.runs[vestige.primaryRunIdx];
});
// These indexes depend on transcript content, never on playback time.
const wordStarts = $derived(run?.transcript.filter(segment => segment.token.text.trim()).map(segment => segment.range.start).sort((a, b) => a - b) ?? []);
const intervals = $derived.by(() => {
    const ranges = run?.transcript.map((segment, index) => ({ index, start: segment.range.start, end: segment.range.end }))
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

export function getWordPosition(time: number, direction: -1 | 1): number | null {
    const starts = wordStarts;
    const boundary = time + direction * 0.001;
    let start = 0;
    let end = starts.length;
    while (start < end) {
        const middle = Math.floor((start + end) / 2);
        if (direction === 1 ? starts[middle] <= boundary : starts[middle] < boundary) start = middle + 1;
        else end = middle;
    }
    return starts[direction === 1 ? start : start - 1] ?? null;
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