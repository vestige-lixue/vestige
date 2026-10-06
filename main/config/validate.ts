import { isLocale } from "../../shared/locale";
import { FailureError } from "../../shared/failure";
import { type Config, type ConfigPatch, type PlaybackConfigPatch } from "../../shared/config/Config";
import { configVersion, defaultConfig, minWindowHeight, minWindowWidth, validConcurrency, validSidebarWidth, validPlaybackSpeed, validPlaybackVolume } from "../../shared/config/defaults";

function record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function dimension(value: unknown, minimum: number, fallback: number): number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= 2147483647 ? value : fallback;
}

export function normalizeConfig(value: unknown): Config {
    const defaults = defaultConfig();
    const source = record(value);
    // Add migrations for recognized older versions here, before stripping fields.
    // Missing, malformed and unsupported versions all use the current defaults.
    if (source?.version !== configVersion) return defaults;
    const transcription = record(source.transcription);
    const window = record(source.window);
    const layout = record(source.layout);
    const playback = record(source.playback);
    return {
        version: configVersion,
        language: isLocale(source.language) ? source.language : defaults.language,
        transcription: {
            concurrency: validConcurrency(transcription?.concurrency) ? transcription.concurrency : defaults.transcription.concurrency
        },
        window: {
            width: dimension(window?.width, minWindowWidth, defaults.window.width),
            height: dimension(window?.height, minWindowHeight, defaults.window.height),
            maximized: typeof window?.maximized === "boolean" ? window.maximized : defaults.window.maximized
        },
        layout: {
            sidebarWidth: validSidebarWidth(layout?.sidebarWidth) ? layout.sidebarWidth : defaults.layout.sidebarWidth
        },
        playback: {
            volumeStabilization: typeof playback?.volumeStabilization === "boolean" ? playback.volumeStabilization : defaults.playback.volumeStabilization,
            volume: validPlaybackVolume(playback?.volume) ? playback.volume : defaults.playback.volume,
            speed: validPlaybackSpeed(playback?.speed) ? playback.speed : defaults.playback.speed,
            savedSpeed: validPlaybackSpeed(playback?.savedSpeed) ? playback.savedSpeed : defaults.playback.savedSpeed
        }
    };
}

export function validatePatch(value: unknown): ConfigPatch {
    const patch = record(value);
    const transcription = record(patch?.transcription);
    if (!patch || Object.keys(patch).length === 0
        || Object.keys(patch).some(key => !["language", "transcription"].includes(key))
        || ("language" in patch && !isLocale(patch.language))
        || ("transcription" in patch && (!transcription || Object.keys(transcription).length !== 1
            || !validConcurrency(transcription.concurrency)))) {
        throw new FailureError({ kind: "config-invalid-update" });
    }
    return {
        ...("language" in patch ? { language: patch.language as Config["language"] } : {}),
        ...(transcription ? { transcription: { concurrency: transcription.concurrency as number } } : {})
    };
}

export function validatePlaybackPatch(value: unknown): PlaybackConfigPatch {
    const patch = record(value);
    if (!patch || Object.keys(patch).length === 0
        || Object.keys(patch).some(key => !["volumeStabilization", "volume", "speed", "savedSpeed"].includes(key))
        || ("volumeStabilization" in patch && typeof patch.volumeStabilization !== "boolean")
        || ("volume" in patch && !validPlaybackVolume(patch.volume))
        || ("speed" in patch && !validPlaybackSpeed(patch.speed))
        || ("savedSpeed" in patch && patch.savedSpeed !== null && !validPlaybackSpeed(patch.savedSpeed))) {
        throw new FailureError({ kind: "config-invalid-playback" });
    }
    return { ...patch } as PlaybackConfigPatch;
}