import { toFailureInfo } from "../../shared/failure";
import { tick } from "svelte";
import * as project from "./project.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as settings from "./settings.svelte";
import { minPlaybackSpeed, maxPlaybackSpeed } from "../../shared/constants";

export const minSpeed = minPlaybackSpeed;
export const maxSpeed = maxPlaybackSpeed;
export const speedStep = 0.05;

export type SeekMode = "preview" | "commit";

const state = $state({ url: null as string | null, playing: false, playVersion: 0, currentTime: 0, seekVersion: 0, seekMode: "commit" as SeekMode });
let handle: { id: string; url: string } | null = null;
let queued = false;
let switching: Promise<void> | null = null;
let pendingPlaying = false;
let generation = 0;
let interruptionVersion = 0;
let progressReader: (() => void) | null = null;

export function registerProgressReader(read: () => void): () => void {
    progressReader = read;
    return () => {
        if (progressReader === read) progressReader = null;
    };
}

export function captureProgress(): void {
    progressReader?.();
}

export function getURL(): string | null {
    return state.url;
}

export function isPlaying(): boolean {
    return state.playing;
}

export function getPlayVersion(): number {
    return state.playVersion;
}

export function getCurrentTime(): number {
    return state.currentTime;
}

export function getSeekVersion(): number {
    return state.seekVersion;
}

export function getSeekMode(): SeekMode {
    return state.seekMode;
}

// Finish the last accepted preview, including when pointer interaction is cancelled.
export function commitSeekPreview(): void {
    if (state.seekMode !== "preview") return;
    project.seekPlayback(state.currentTime, "commit");
}

export function getSpeed(): number {
    return settings.getPlayback().speed;
}

export function getVolume(): number {
    return settings.getPlayback().volume;
}

export function isVolumeStabilizationEnabled(): boolean {
    return settings.getPlayback().volumeStabilization;
}

// Project coordinates timeline changes; components only read currentTime.
export function updatePlaybackTime(time: number, seek: SeekMode | null): void {
    state.currentTime = time;
    if (seek !== null) {
        state.seekMode = seek;
        state.seekVersion++;
    }
}

export function togglePlaying(): void {
    setPlaying(!state.playing);
}

export function setPlaying(playing: boolean): void {
    state.playVersion++;
    const media = project.getMedia(mediaSelection.get());
    if (playing && media && media.duration > 0 && state.currentTime >= media.duration) project.seekPlayback(0);
    state.playing = state.url !== null && playing;
    if (!state.playing) captureProgress();
}

export function pauseForInterruption(): void {
    interruptionVersion++;
    pendingPlaying = false;
    setPlaying(false);
}

export function pauseForProjectChange(): () => void {
    const current = generation;
    const interruption = interruptionVersion;
    const id = mediaSelection.get();
    const playing = state.url === null ? pendingPlaying : state.playing;
    pendingPlaying = false;
    commitSeekPreview();
    setPlaying(false);
    return () => {
        if (current !== generation || interruption !== interruptionVersion || id !== mediaSelection.get()) return;
        pendingPlaying = playing;
        if (state.url !== null) setPlaying(playing);
    };
}

export function setSpeed(speed: number): void {
    if (Number.isFinite(speed)) void settings.update({ playback: { speed: Math.min(maxSpeed, Math.max(minSpeed, speed)) } });
}

export function saveSpeed(): void {
    void settings.update({ playback: { savedSpeed: getSpeed() } });
}

export function restoreSpeed(): void {
    const { speed, savedSpeed } = settings.getPlayback();
    if (speed !== 1) void settings.update({ playback: { savedSpeed: speed, speed: 1 } });
    else if (savedSpeed !== null) void settings.update({ playback: { speed: savedSpeed } });
}

export function setVolume(volume: number): void {
    if (Number.isFinite(volume)) void settings.update({ playback: { volume: Math.min(1, Math.max(0, volume)) } });
}

export function toggleVolumeStabilization(): void {
    setVolumeStabilization(!isVolumeStabilizationEnabled());
}

export function setVolumeStabilization(enabled: boolean): void {
    void settings.update({ playback: { volumeStabilization: enabled } });
}

export function reset(): Promise<void> {
    generation++;
    return synchronize();
}

export function switchMedia(): Promise<void> {
    // Keep the requested state across rapid selections while the next URL is loading.
    const playing = state.url === null ? pendingPlaying : state.playing;
    const nextPlaying = { pause: false, play: true, keep: playing, invert: !playing }[settings.getPlayback().mediaSwitchPlayback];
    return synchronize(mediaSelection.get() !== null && nextPlaying);
}

export function synchronize(playing = false): Promise<void> {
    pendingPlaying = playing;
    state.url = null;
    state.playing = false;
    project.restorePlayback();
    queued = true;
    switching ??= drain().then(() => {
        switching = null;
        return queued ? synchronize(pendingPlaying) : undefined;
    }, error => {
        switching = null;
        queued = false;
        pendingPlaying = false;
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
            if (matches()) mediaImport.reportPlaybackFailure(id, "unreadable", toFailureInfo(error));
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
        setPlaying(pendingPlaying);
    }
}