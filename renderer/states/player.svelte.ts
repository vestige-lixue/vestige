import { tick } from "svelte";
import * as project from "./project.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as mediaSelection from "./mediaSelection.svelte";

const state = $state({ url: null as string | null, playing: false, currentTime: 0, seekVersion: 0, speed: 1 });
let handle: { id: string; url: string } | null = null;
let queued = false;
let switching: Promise<void> | null = null;
let generation = 0;

export function getURL(): string | null {
    return state.url;
}

export function isPlaying(): boolean {
    return state.playing;
}

export function getCurrentTime(): number {
    return state.currentTime;
}

export function getSeekVersion(): number {
    return state.seekVersion;
}

export function getSpeed(): number {
    return state.speed;
}

// Project coordinates timeline changes; components only read currentTime.
export function updatePlaybackTime(time: number, seek: boolean): void {
    state.currentTime = time;
    if (seek) state.seekVersion++;
}

export function togglePlaying(): void {
    if (state.url) state.playing = !state.playing;
}

export function setPlaying(playing: boolean): void {
    state.playing = state.url !== null && playing;
}

export function setSpeed(speed: number): void {
    state.speed = speed;
}

export function reset(): Promise<void> {
    generation++;
    return synchronize();
}

export function synchronize(): Promise<void> {
    state.url = null;
    state.playing = false;
    project.resetPlayback();
    queued = true;
    switching ??= drain().then(() => {
        switching = null;
        return queued ? synchronize() : undefined;
    }, error => {
        switching = null;
        queued = false;
        throw error;
    });
    return switching;
}

// Keep one acquisition in flight and coalesce pending selections to the latest UUID.
async function drain(): Promise<void> {
    while (queued) {
        queued = false;
        // Let Player detach the old element before asking the backend to close its reads.
        await tick();
        if (handle) {
            await window.api.file.releaseMediaURL(handle.id);
            handle = null;
        }
        const current = generation;
        const id = mediaSelection.get();
        const path = project.getMedia(id)?.path;
        if (!id || !path) continue;
        const matches = (): boolean => current === generation && mediaSelection.get() === id
            && mediaImport.isReady(id) && project.getMedia(id)?.path === path;
        let result;
        try {
            result = await window.api.file.getMediaURL(path);
        }
        catch (error) {
            console.error(error);
            if (matches()) mediaImport.reportPlaybackFailure(id, "unreadable", error instanceof Error ? error.message : String(error));
            else queued = true;
            continue;
        }
        if (!matches()) {
            if (result.status === "ready") handle = result;
            queued = true;
            continue;
        }
        // An A -> B -> A selection can reuse A if its project and path still match.
        queued = false;
        if (result.status !== "ready") {
            mediaImport.reportPlaybackFailure(id, result.status, result.error);
            continue;
        }
        handle = result;
        state.url = result.url;
    }
}