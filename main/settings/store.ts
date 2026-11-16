import { type FailureInfo, toFailureInfo, isExpectedFailure } from "../../shared/failure";
import { isSystemError } from "../util/file";
import { fileOperationFailure, statOrNull } from "../util/fs";
import { join } from "node:path";
import { copyFile } from "node:fs/promises";
import { type Settings, type SettingsResult, type SettingsSnapshot, type SettingsRecoveryResult } from "../../shared/settings/Settings";
import { mergeSettings } from "../../shared/settings/merge";
import { freezeSnapshot } from "../../shared/settings/snapshot";
import { readSettings, writeSettings } from "./file";
import { validSettings, validWindowSettings, validatePatch } from "./validate";

const saveDelayMs = 500;
const saveMaxWaitMs = 5000;
let path: string;
let preferredLanguages: readonly string[] = [];
let settings: Settings;
let currentText: string;
let savedText: string | null;
let revision = 0;
let settingsRevision = 0;
let savedRevision = -1;
let pendingSaves = 0;
let error: FailureInfo | null = null;
let loadError: FailureInfo | null = null;
let writes: Promise<void> = Promise.resolve();
let delayTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(snapshot: SettingsSnapshot) => void>();

export function initialize(root: string, languages: readonly string[] = []): void {
    path = join(root, "settings.json");
    preferredLanguages = [...languages];
    const loaded = readSettings(path, preferredLanguages);
    settings = loaded.settings;
    currentText = JSON.stringify(settings);
    savedText = loaded.savedText;
    loadError = loaded.loadError;
    savedRevision = currentText === savedText ? settingsRevision : -1;
}

export function get(): SettingsSnapshot {
    return freezeSnapshot({
        settings: structuredClone(settings), revision, settingsRevision, savedRevision,
        dirty: currentText !== savedText, saving: pendingSaves > 0, error, loadError
    });
}

export function subscribe(listener: (snapshot: SettingsSnapshot) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify(): void {
    revision++;
    const snapshot = get();
    for (const listener of listeners) {
        try {
            listener(snapshot);
        }
        catch (error) {
            console.error(error);
        }
    }
}

function cancelTimers(): void {
    if (delayTimer !== null) clearTimeout(delayTimer);
    if (maxWaitTimer !== null) clearTimeout(maxWaitTimer);
    delayTimer = maxWaitTimer = null;
}

function scheduleSave(): void {
    if (loadError !== null || (currentText === savedText && pendingSaves === 0)) {
        cancelTimers();
        return;
    }
    const persist = (): void => {
        void flush(settingsRevision).catch(console.error);
    };
    if (delayTimer !== null) clearTimeout(delayTimer);
    delayTimer = setTimeout(persist, saveDelayMs);
    maxWaitTimer ??= setTimeout(persist, saveMaxWaitMs);
}

function accept(next: Settings): void {
    const text = JSON.stringify(next);
    if (text === currentText) return;
    settings = next;
    currentText = text;
    settingsRevision++;
    notify();
    scheduleSave();
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
    // Acceptance is independent of disk persistence. Callers cannot mutate the
    // accepted value through their original patch or a published snapshot.
    accept(mergeSettings(settings, structuredClone(patch)));
    return { success: true, snapshot: get() };
}

export function updateWindow(window: Settings["window"]): void {
    if (validWindowSettings(window)) accept({ ...settings, window: { ...window } });
}

export function replace(value: unknown): SettingsResult {
    if (!validSettings(value)) return { success: false, error: { kind: "settings-invalid-update" }, snapshot: get() };
    accept({ ...structuredClone(value), window: settings.window });
    return { success: true, snapshot: get() };
}

function queue<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = writes.then(operation);
    writes = result.then(() => {}, () => {});
    return result;
}

function reload(): SettingsResult {
    if (loadError === null) return { success: true, snapshot: get() };
    const loaded = readSettings(path, preferredLanguages);
    loadError = loaded.loadError;
    if (loadError !== null) {
        notify();
        return { success: false, error: loadError, snapshot: get() };
    }
    if (loaded.savedText !== null) {
        savedText = loaded.savedText;
        accept({ ...loaded.settings, window: settings.window });
        savedRevision = currentText === savedText ? settingsRevision : -1;
    }
    scheduleSave();
    notify();
    return { success: true, snapshot: get() };
}

export function retryLoad(): Promise<SettingsResult> {
    return queue(reload);
}

export function backupAndReset(selectPath: () => Promise<string | null>): Promise<SettingsRecoveryResult> {
    return queue(async () => {
        if (loadError === null) return { success: true, canceled: false, snapshot: get() };
        let source: Awaited<ReturnType<typeof statOrNull>>;
        try {
            source = await statOrNull(path);
        }
        catch (cause) {
            return { success: false, error: isSystemError(cause) ? fileOperationFailure(cause, "read", path) : toFailureInfo(cause) };
        }
        if (source === null) {
            const result = reload();
            return result.success ? { success: true, canceled: false, snapshot: result.snapshot }
                : { success: false, error: result.error };
        }
        const backup = await selectPath();
        if (backup === null) return { success: true, canceled: true, snapshot: get() };
        try {
            // Links to the live file would lose their backup when settings are reset.
            const destination = await statOrNull(backup);
            if (destination && source.dev === destination.dev && source.ino === destination.ino) {
                return { success: false, error: { kind: "backup-same-file" } };
            }
            await copyFile(path, backup);
        }
        catch (cause) {
            return { success: false, error: isSystemError(cause) ? fileOperationFailure(cause, "write", backup) : toFailureInfo(cause) };
        }
        loadError = null;
        cancelTimers();
        pendingSaves++;
        notify();
        const result = await persist(settings, currentText, settingsRevision);
        return result.success ? { success: true, canceled: false, snapshot: result.snapshot }
            : { success: false, error: result.error };
    });
}

export function flush(target: number): Promise<SettingsResult> {
    if (loadError !== null) return Promise.resolve({ success: true, snapshot: get() });
    if (!Number.isSafeInteger(target) || target < 0 || target > settingsRevision) {
        return Promise.resolve({ success: false, error: { kind: "settings-invalid-update" }, snapshot: get() });
    }
    cancelTimers();
    // Capture a version at or after the requested acceptance. Changes arriving
    // during this write keep their own debounce and cannot be marked durable by it.
    const current = settings;
    const text = currentText;
    const version = settingsRevision;
    pendingSaves++;
    notify();
    return queue(() => persist(current, text, version));
}

async function persist(current: Settings, text: string, version: number): Promise<SettingsResult> {
    let failure: FailureInfo | null = null;
    try {
        if (loadError === null) {
            if (text !== savedText) await writeSettings(path, JSON.stringify(current, null, 4));
            savedText = text;
            savedRevision = version;
            error = null;
        }
    }
    catch (cause) {
        failure = isSystemError(cause) ? fileOperationFailure(cause, "write", path) : toFailureInfo(cause);
        error = failure;
        console.error("Could not save settings:", path, cause);
    }
    finally {
        pendingSaves--;
        notify();
    }
    return failure === null ? { success: true, snapshot: get() }
        : { success: false, error: failure, snapshot: get() };
}