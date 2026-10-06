import { defaultLocale } from "../locale";
import { type Config } from "./Config";

export const configVersion = 1;
export const minWindowWidth = 640;
export const minWindowHeight = 480;
export const minSidebarWidth = 150;
export const maxSidebarWidth = 750;
export const minPlaybackSpeed = 0.2;
export const maxPlaybackSpeed = 3;

export function defaultConfig(): Config {
    return {
        version: configVersion,
        language: defaultLocale,
        transcription: { concurrency: 1 },
        window: { width: 800, height: 600, maximized: false },
        layout: { sidebarWidth: null },
        playback: { volumeStabilization: false, volume: 1, speed: 1, savedSpeed: null }
    };
}

export function validConcurrency(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

export function validSidebarWidth(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= minSidebarWidth && value <= maxSidebarWidth;
}

export function validPlaybackSpeed(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= minPlaybackSpeed && value <= maxPlaybackSpeed;
}

export function validPlaybackVolume(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}