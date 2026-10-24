import { playbackModes } from "../../shared/settings/options";
import { toFailureInfo } from "../../shared/failure";
import { tick } from "svelte";
import * as project from "./project.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as settings from "./settings.svelte";
import * as player from "./player.svelte";
import * as projectAPI from "./project";
import * as settingsAPI from "./settings";
import * as mediaImportAPI from "./mediaImport";

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

// Finish the last accepted preview, including when pointer interaction is cancelled.
export function commitSeekPreview(): void {
    if (player.state.seekMode !== "preview") return;
    projectAPI.seekPlayback(player.state.currentTime, "commit");
}

// Project coordinates timeline changes; components only read currentTime.
export function updatePlaybackTime(time: number, seek: player.SeekMode | null): void {
    player.state.currentTime = time;
    if (seek !== null) {
        player.state.seekMode = seek;
        player.state.seekVersion++;
    }
}

export function togglePlaying(): void {
    setPlaying(!player.state.playing);
}

export function setPlaying(playing: boolean): void {
    player.state.playVersion++;
    const media = project.getMedia(mediaSelection.get());
    if (playing && media && media.duration > 0 && player.state.currentTime >= media.duration) projectAPI.seekPlayback(0);
    player.state.playing = player.state.url !== null && playing;
    if (!player.state.playing) captureProgress();
}

export function cycleMode(): void {
    const mode = playbackModes[(playbackModes.indexOf(player.getMode()) + 1) % playbackModes.length];
    void settingsAPI.update({ playback: { mode } });
}

export function finishPlayback(): void {
    if (!player.isPlaying() || !player.getURL()) return;
    const mode = player.getMode();
    if (mode === "single") {
        setPlaying(false);
        return;
    }
    if (mode !== "repeat-one") {
        const next = mediaSelection.adjacent(1, mode === "repeat-all");
        if (next !== null) {
            projectAPI.selectMedia(next, true);
            return;
        }
        if (mode === "sequential") {
            setPlaying(false);
            return;
        }
    }
    // Repeating the only ready item in a list uses the same path as repeat-one.
    projectAPI.seekPlayback(0);
    setPlaying(true);
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
    const playing = player.state.url === null ? pendingPlaying : player.state.playing;
    pendingPlaying = false;
    commitSeekPreview();
    setPlaying(false);
    return () => {
        if (current !== generation || interruption !== interruptionVersion || id !== mediaSelection.get()) return;
        pendingPlaying = playing;
        if (player.state.url !== null) setPlaying(playing);
    };
}

export function setSpeed(speed: number): void {
    if (Number.isFinite(speed)) void settingsAPI.update({ playback: { speed: Math.min(player.maxSpeed, Math.max(player.minSpeed, speed)) } });
}

export function saveSpeed(): void {
    void settingsAPI.update({ playback: { savedSpeed: player.getSpeed() } });
}

export function restoreSpeed(): void {
    const { speed, savedSpeed } = settings.getPlayback();
    if (speed !== 1) void settingsAPI.update({ playback: { savedSpeed: speed, speed: 1 } });
    else if (savedSpeed !== null) void settingsAPI.update({ playback: { speed: savedSpeed } });
}

export function setVolume(volume: number): void {
    if (Number.isFinite(volume)) void settingsAPI.update({ playback: { volume: Math.min(1, Math.max(0, volume)) } });
}

export function toggleVolumeStabilization(): void {
    setVolumeStabilization(!player.isVolumeStabilizationEnabled());
}

export function setVolumeStabilization(enabled: boolean): void {
    void settingsAPI.update({ playback: { volumeStabilization: enabled } });
}

export function reset(): Promise<void> {
    generation++;
    return synchronize();
}

export function switchMedia(): Promise<void> {
    // Keep the requested state across rapid selections while the next URL is loading.
    const playing = player.state.url === null ? pendingPlaying : player.state.playing;
    const nextPlaying = { pause: false, play: true, keep: playing, invert: !playing }[settings.getPlayback().mediaSwitchPlayback];
    return synchronize(mediaSelection.get() !== null && nextPlaying);
}

export function synchronize(playing = false): Promise<void> {
    pendingPlaying = playing;
    player.state.url = null;
    player.state.playing = false;
    projectAPI.restorePlayback();
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
            if (matches()) mediaImportAPI.reportPlaybackFailure(id, "unreadable", toFailureInfo(error));
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
            mediaImportAPI.reportPlaybackFailure(id, result.status, result.error);
            continue;
        }
        handle = result;
        player.state.url = result.url;
        setPlaying(pendingPlaying);
    }
}