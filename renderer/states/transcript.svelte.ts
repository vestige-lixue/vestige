import { type Run } from "../../shared/transcription/Run";
import { type Vestige } from "../../shared/Vestige";
import { type Range } from "../../shared/util/range";
import { SvelteMap } from "svelte/reactivity";
import { unplayableTimestamp, type InspectionInformation } from "../editor/informationModel";
import * as project from "./project.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as settings from "./settings.svelte";

const vestige = $derived(project.getVestige(mediaSelection.get()));
const run = $derived(vestige?.runs[vestige.displayedRunIdx]);
const duration = $derived(vestige?.media.duration ?? 0);
const references = new SvelteMap<string, string>();
const showReferenceTranscript = $derived(settings.getCurrent().layout.showReferenceTranscript);

function referenceRun(item: Vestige): Run | undefined {
    const remembered = references.get(item.media.id);
    const displayed = item.runs[item.displayedRunIdx];
    let latest: Run | undefined;
    for (const candidate of item.runs) {
        if (candidate === displayed) continue;
        if (candidate.id === remembered) return candidate;
        if (!latest || candidate.startedAt > latest.startedAt) latest = candidate;
    }
    return latest;
}

const reference = $derived(showReferenceTranscript && vestige ? referenceRun(vestige) : undefined);
export function getReference(): Run | undefined {
    return reference;
}

export function rememberReference(mediaId: string, runId: string): void {
    references.set(mediaId, runId);
}

export function swapReference(item: Vestige, next: Run): void {
    if ((showReferenceTranscript || references.has(item.media.id)) && referenceRun(item) === next)
        rememberReference(item.media.id, item.runs[item.displayedRunIdx].id);
}

export function referenceAfterRemoval(item: Vestige, removedId: string): void {
    const id = item.media.id;
    if (references.get(id) !== removedId) return;
    const next = referenceRun(item);
    if (next) rememberReference(id, next.id);
    else references.delete(id);
}

type Inspection = { mediaId: string; runId: string; information: InspectionInformation };
let inspections = $state.raw<Inspection[]>([]);
const inspected = $derived(inspections.findLast(item => item.mediaId === vestige?.media.id && vestige.runs.some(run => run.id === item.runId))?.information ?? null);

export function setInspection(mediaId: string, runId: string, information: InspectionInformation | null): void {
    const others = inspections.filter(item => item.mediaId !== mediaId || item.runId !== runId);
    if (information) inspections = [...others, { mediaId, runId, information }];
    else if (others.length !== inspections.length) inspections = others;
}

export function getInspection(): InspectionInformation | null {
    return inspected;
}

export function getInspectionRange(): Range | null {
    return inspected?.range ?? null;
}

type InspectionTick = { time: number; danger: boolean };
export function getInspectionTicks(duration: number): InspectionTick[] {
    const range = getInspectionRange();
    if (!range || inspected?.playable === undefined || !Number.isFinite(duration) || duration <= 0) return [];
    const { playable } = inspected;
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