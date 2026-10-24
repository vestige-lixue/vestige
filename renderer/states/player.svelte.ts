import { type SeekMode } from "../audio/transport";
export { type SeekMode } from "../audio/transport";

import * as settings from "./settings.svelte";
import { minPlaybackSpeed, maxPlaybackSpeed } from "../../shared/constants";
import { type PlaybackMode } from "../../shared/settings/Settings";

export const minSpeed = minPlaybackSpeed;
export const maxSpeed = maxPlaybackSpeed;
export const speedStep = 0.05;

export const state = $state({ url: null as string | null, playing: false, playVersion: 0, currentTime: 0, seekVersion: 0, seekMode: "commit" as SeekMode });

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

export function getMode(): PlaybackMode {
    return settings.getPlayback().mode;
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