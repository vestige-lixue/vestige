import * as transcript from "./transcript.svelte";

export function getWordIndex(time: number): number {
    const starts = transcript.getWordStarts();
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
    return transcript.getWordStarts()[fromIndex + direction] ?? null;
}

export function getActiveSegments(time: number): number[] {
    const active: number[] = [];
    function visit(node: transcript.IntervalNode | null): void {
        if (!node || node.maxEnd <= time) return;
        visit(node.left);
        if (node.start > time) return;
        if (time < node.end) active.push(node.index);
        visit(node.right);
    }
    visit(transcript.getIntervals());
    return active;
}