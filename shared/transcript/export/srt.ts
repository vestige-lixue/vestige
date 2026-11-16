import { type SrtOptions } from "../export";
import { timeRange, type TimedText } from "./timing";
import { type TextLayout, type TextRange } from "./breaks";
import { subtitleLines } from "./lines";

function timestamp(seconds: number): string {
    const milliseconds = Math.round(seconds * 1000);
    return `${Math.floor(milliseconds / 3600000).toString().padStart(2, "0")}:${Math.floor(milliseconds / 60000 % 60).toString().padStart(2, "0")}:${Math.floor(milliseconds / 1000 % 60).toString().padStart(2, "0")},${(milliseconds % 1000).toString().padStart(3, "0")}`;
}

export function writeSrt(timed: TimedText, layout: TextLayout, ranges: readonly TextRange[], duration: number, options: SrtOptions): { text: string; unanchored: number; estimated: boolean } {
    // At each atom boundary, skip point-timed text and newlines on both sides.
    const before = new Int32Array(timed.text.length + 1).fill(-1), after = new Int32Array(timed.text.length + 1).fill(-1);
    for (let i = 0; i < timed.text.length; i++) before[i + 1] = timed.end[i] > timed.start[i] ? timed.group[i] : before[i];
    for (let i = timed.text.length - 1; i >= 0; i--) after[i] = timed.end[i] > timed.start[i] ? timed.group[i] : after[i + 1];
    let estimated = false;
    const cues = ranges.flatMap(({ from, to }) => {
        const lines = subtitleLines(layout, from, to, options.maxLineWidth);
        if (!lines.length) return [];
        const start = layout.offsets[from], end = layout.offsets[to];
        for (const offset of [start, end]) {
            if (before[offset] >= 0 && before[offset] === after[offset]) estimated = true;
        }
        const audio = timeRange(timed, start, end) ?? { start: 0, end: 0 };
        return [{ lines, range: { start: Math.max(0, Math.min(duration, audio.start)), end: Math.max(0, Math.min(duration, audio.end)) } }];
    });
    for (let i = 0; i < cues.length; i++) {
        const range = cues[i].range;
        range.start = Math.max(range.start, cues[i - 1]?.range.start ?? 0);
        range.end = Math.max(range.start, range.end);
    }
    const blocks = cues.map((cue, i) => {
        const range = cue.range, nextStart = cues[i + 1]?.range.start ?? duration;
        if (range.end > nextStart && nextStart > range.start) range.end = nextStart;
        range.end = Math.max(range.end, Math.min(range.start + options.minDurationSeconds, nextStart, duration));
        return `${i + 1}\r\n${timestamp(range.start)} --> ${timestamp(range.end)}\r\n${cue.lines.join("\r\n")}`;
    });
    return { text: blocks.join("\r\n\r\n"), unanchored: timed.unanchored, estimated };
}