import { type Run, type TranscriptSpan } from "../transcription/Run";
import { type Range } from "../util/range";
import { firstTrue } from "../util/search";

export type ReferenceCandidate = { text: string; range: Range; tokens: number[] };
type Entry = { token: number; span: TranscriptSpan; end: number };
const indexes = new WeakMap<Run, Entry[]>();

function indexOf(run: Run): Entry[] {
    let entries = indexes.get(run);
    if (entries) return entries;
    entries = run.transcript.map((span, token) => ({ token, span, end: 0 })).sort((a, b) => a.span.range.start - b.span.range.start || a.token - b.token);
    let end = 0;
    for (const entry of entries) entry.end = end = Math.max(end, entry.span.range.end);
    indexes.set(run, entries);
    return entries;
}

export function referenceCandidate(run: Run, target: Range, threshold: number): ReferenceCandidate | null {
    const entries = indexOf(run);
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