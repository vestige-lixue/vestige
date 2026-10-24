import { type FailureInfo, toFailureInfo, isExpectedFailure } from "../../shared/failure";
import { isSystemError } from "../util/file";
import { fileOperationFailure } from "../util/fs";
import { join } from "node:path";
import { type Settings, type SettingsResult, type SettingsSnapshot } from "../../shared/settings/Settings";
import { readSettings, writeSettings } from "./file";
import { validWindowSettings, validatePatch } from "./validate";

let path: string;
let settings: Settings;
let savedText: string | null;
let revision = 0;
let pendingSaves = 0;
let error: FailureInfo | null = null;
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<(snapshot: SettingsSnapshot) => void>();

export function initialize(root: string): void {
    path = join(root, "settings.json");
    const loaded = readSettings(path);
    settings = loaded.settings;
    savedText = loaded.savedText;
}

export function get(): SettingsSnapshot {
    return {
        settings: structuredClone(settings), revision,
        dirty: JSON.stringify(settings) !== savedText,
        saving: pendingSaves > 0, error
    };
}

export function subscribe(listener: (snapshot: SettingsSnapshot) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify(): void {
    revision++;
    for (const listener of listeners) {
        try {
            listener(get());
        }
        catch (error) {
            console.error(error);
        }
    }
}

export function update(value: unknown): SettingsResult {
    let patch: ReturnType<typeof validatePatch>;
    try {
        patch = validatePatch(value);
    }
    catch (error) {
        if (!isExpectedFailure(error)) throw error;
        return { success: false, error: toFailureInfo(error), snapshot: get() };
    }
    const next: Settings = {
        ...settings, ...patch,
        // Each palette replaces its overrides, so an empty object restores its defaults.
        theme: { ...settings.theme, ...patch.theme },
        transcription: { ...settings.transcription, ...patch.transcription },
        editing: { ...settings.editing, ...patch.editing },
        volumeStabilization: { ...settings.volumeStabilization, ...patch.volumeStabilization },
        layout: { ...settings.layout, ...patch.layout },
        playback: { ...settings.playback, ...patch.playback }
    };
    if (JSON.stringify(next) !== JSON.stringify(settings)) {
        settings = next;
        notify();
    }
    return { success: true, snapshot: get() };
}

export function updateWindow(window: Settings["window"]): void {
    if (!validWindowSettings(window) || JSON.stringify(window) === JSON.stringify(settings.window)) return;
    settings = { ...settings, window: { ...window } };
    notify();
}

export function save(): Promise<SettingsResult> {
    // Capture at the explicit request, even when an earlier save is pending.
    const current = settings;
    const text = JSON.stringify(current);
    pendingSaves++;
    error = null;
    notify();
    const operation = writes.then(async (): Promise<SettingsResult> => {
        try {
            await writeSettings(path, JSON.stringify(current, null, 4));
            savedText = text;
            error = null;
        }
        catch (cause) {
            if (!isSystemError(cause) && !isExpectedFailure(cause)) throw cause;
            error = isSystemError(cause) ? fileOperationFailure(cause, "write", path) : toFailureInfo(cause);
        }
        finally {
            pendingSaves--;
            notify();
        }
        return error === null ? { success: true, snapshot: get() }
            : { success: false, error, snapshot: get() };
    });
    writes = operation.then(() => {}, () => {});
    return operation;
}