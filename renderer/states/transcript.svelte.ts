import { type Run } from "../../shared/transcription/Run";
import { type Range } from "../../shared/util/range";
import { unplayableTimestamp } from "../editor/informationModel";
import * as project from "./project.svelte";
import * as mediaSelection from "./mediaSelection.svelte";

const vestige = $derived(project.getVestige(mediaSelection.get()));
const run = $derived(vestige?.runs[vestige.displayedRunIdx]);
const duration = $derived(vestige?.media.duration ?? 0);
let inspection = $state.raw<{ mediaId: string; runId: string; range: Range; playable: boolean | undefined } | null>(null);

export function setInspection(value: typeof inspection): void {
    inspection = value;
}

export function getInspectionRange(): Range | null {
    return inspection?.mediaId === mediaSelection.get() && inspection?.runId === run?.id ? inspection?.range ?? null : null;
}

type InspectionTick = { time: number; danger: boolean };
export function getInspectionTicks(duration: number): InspectionTick[] {
    const range = getInspectionRange();
    if (!range || inspection?.playable === undefined || !Number.isFinite(duration) || duration <= 0) return [];
    const { playable } = inspection;
    const tick = (time: number): InspectionTick => ({
        time: Math.max(0, Math.min(duration, time)),
        danger: unplayableTimestamp(time, duration, playable)
    });
    const start = tick(range.start), end = tick(range.end);
    return start.time === end.time ? [start] : [start, end];
}

// Playback indexes exclude unreachable times without changing stored timestamps.
const wordStarts = $derived([...new Set(run?.transcript.filter(segment => segment.token.text.trim()
    && segment.range.start >= 0 && segment.range.start < duration).map(segment => segment.range.start) ?? [])].sort((a, b) => a - b));
export function getRun(): Run | undefined {
    return run;
}

export function getWordStarts(): readonly number[] {
    return wordStarts;
}