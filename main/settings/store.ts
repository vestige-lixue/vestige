import { type FailureInfo, toFailureInfo, isExpectedFailure } from "../../shared/failure";
import { isSystemError } from "../util/file";
import { fileOperationFailure } from "../util/fs";
import { join } from "node:path";
import { type Settings, type SettingsResult, type SettingsSnapshot } from "../../shared/settings/Settings";
import { mergeSettings } from "../../shared/settings/merge";
import { freezeSnapshot } from "../../shared/settings/snapshot";
import { readSettings, writeSettings } from "./file";
import { validWindowSettings, validatePatch } from "./validate";

const saveDelayMs = 500;
const saveMaxWaitMs = 5000;
let path: string;
let settings: Settings;
let currentText: string;
let savedText: string | null;
let revision = 0;
let settingsRevision = 0;
let savedRevision = -1;
let pendingSaves = 0;
let error: FailureInfo | null = null;
let writes: Promise<void> = Promise.resolve();
let delayTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(snapshot: SettingsSnapshot) => void>();

export function initialize(root: string): void {
    path = join(root, "settings.json");
    const loaded = readSettings(path);
    settings = loaded.settings;
    currentText = JSON.stringify(settings);
    savedText = loaded.savedText;
    savedRevision = currentText === savedText ? settingsRevision : -1;
}

export function get(): SettingsSnapshot {
    return freezeSnapshot({
        settings: structuredClone(settings), revision, settingsRevision, savedRevision,
        dirty: currentText !== savedText, saving: pendingSaves > 0, error
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
    if (currentText === savedText && pendingSaves === 0) {
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

export function flush(target: number): Promise<SettingsResult> {
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
    const operation = writes.then(async (): Promise<SettingsResult> => {
        let failure: FailureInfo | null = null;
        try {
            if (text !== savedText) await writeSettings(path, JSON.stringify(current, null, 4));
            savedText = text;
            savedRevision = version;
            error = null;
        }
        catch (cause) {
            failure = isSystemError(cause) ? fileOperationFailure(cause, "write", path) : toFailureInfo(cause);
            error = failure;
        }
        finally {
            pendingSaves--;
            notify();
        }
        return failure === null ? { success: true, snapshot: get() }
            : { success: false, error: failure, snapshot: get() };
    });
    writes = operation.then(() => {}, () => {});
    return operation;
}