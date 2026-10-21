import { toFailureInfo } from "../../shared/failure";
import { type Settings, type SettingsPatch, type SettingsResult, type SettingsSnapshot } from "../../shared/settings/Settings";
import { SvelteSet } from "svelte/reactivity";
import * as settings from "./settings.svelte";

let initialization: Promise<boolean> | null = null;
let unsubscribe: (() => void) | null = null;
let generation = 0;
let updateTask: Promise<boolean> | null = null;
const listeners = new SvelteSet<(value: Settings | null) => void>();
const editors = new SvelteSet<() => Promise<boolean>>();
const updates = new SvelteSet<Promise<boolean>>();

function notify(): void {
    for (const listener of listeners) {
        try {
            listener(settings.get());
        }
        catch (error) {
            console.error(error);
        }
    }
}

function accept(next: SettingsSnapshot, current: number): void {
    const snapshot = settings.getSnapshot();
    if (current !== generation || (snapshot !== null && next.revision < snapshot.revision)) return;
    Object.freeze(next.settings.theme.light);
    Object.freeze(next.settings.theme.dark);
    Object.freeze(next.settings.theme);
    for (const preset of Object.values(next.settings.transcription.presets)) {
        Object.freeze(preset.params);
        Object.freeze(preset);
    }
    Object.freeze(next.settings.transcription.presets);
    const lastConfig = next.settings.transcription.lastConfig;
    if (lastConfig) {
        Object.freeze(lastConfig.config.params);
        Object.freeze(lastConfig.config);
        Object.freeze(lastConfig);
    }
    Object.freeze(next.settings.transcription);
    Object.freeze(next.settings.editing);
    Object.freeze(next.settings.volumeStabilization);
    Object.freeze(next.settings.window);
    Object.freeze(next.settings.layout);
    Object.freeze(next.settings.playback);
    Object.freeze(next.settings);
    settings.setSnapshot(next);
    notify();
}

export function subscribe(listener: (value: Settings | null) => void): () => void {
    listeners.add(listener);
    listener(settings.get());
    return () => listeners.delete(listener);
}

export function initialize(): Promise<boolean> {
    if (initialization) return initialization;
    if (settings.isReady()) return Promise.resolve(true);
    const current = generation;
    const operation = Promise.resolve().then(async () => {
        try {
            settings.setError(null);
            unsubscribe ??= window.api.settings.onChanged(next => accept(next, current));
            accept(await window.api.settings.get(), current);
            return current === generation && settings.isReady();
        }
        catch (cause) {
            if (current === generation) settings.setError(toFailureInfo(cause));
            return false;
        }
    }).finally(() => {
        if (initialization === operation) initialization = null;
    });
    initialization = operation;
    return initialization;
}

async function request(action: () => Promise<SettingsResult>): Promise<boolean> {
    const current = generation;
    if (!await initialize() || current !== generation) return false;
    try {
        settings.setError(null);
        const result = await action();
        if (current !== generation) return false;
        accept(result.snapshot, current);
        if (!result.success) settings.setError(result.error);
        return result.success;
    }
    catch (cause) {
        if (current === generation) settings.setError(toFailureInfo(cause));
        return false;
    }
}

// Updating is independent of persistence; settings forms explicitly request an immediate save.
export function update(patch: SettingsPatch, options: { save?: boolean } = {}): Promise<boolean> {
    // Merge only supplied fields so startup loading and older IPC replies cannot overwrite newer edits.
    const pendingPatch = settings.getPendingPatch();
    settings.setPendingPatch({
        ...pendingPatch, ...patch,
        ...(patch.theme ? { theme: { ...pendingPatch.theme, ...patch.theme } } : {}),
        ...(patch.transcription ? { transcription: { ...pendingPatch.transcription, ...patch.transcription } } : {}),
        ...(patch.editing ? { editing: { ...pendingPatch.editing, ...patch.editing } } : {}),
        ...(patch.volumeStabilization ? { volumeStabilization: { ...pendingPatch.volumeStabilization, ...patch.volumeStabilization } } : {}),
        ...(patch.layout ? { layout: { ...pendingPatch.layout, ...patch.layout } } : {}),
        ...(patch.playback ? { playback: { ...pendingPatch.playback, ...patch.playback } } : {})
    });
    const current = generation;
    const operation = flushUpdates().then(success => success && current === generation && (options.save ? persist() : true));
    updates.add(operation);
    void operation.finally(() => updates.delete(operation));
    return operation;
}

export function beforeSave(commit: () => Promise<boolean>): () => void {
    editors.add(commit);
    return () => editors.delete(commit);
}

function flushUpdates(): Promise<boolean> {
    if (updateTask) return updateTask;
    const current = generation;
    const operation = Promise.resolve().then(async () => {
        while (current === generation && Object.keys(settings.getPendingPatch()).length > 0) {
            const patch = settings.getPendingPatch();
            if (!await request(() => window.api.settings.update(patch)) || current !== generation) return false;
            // Coalesce changes made during IPC and keep the latest values visible.
            if (settings.getPendingPatch() === patch) settings.setPendingPatch({});
        }
        return current === generation;
    }).finally(() => {
        if (updateTask === operation) updateTask = null;
    });
    updateTask = operation;
    return operation;
}

export async function save(): Promise<boolean> {
    const current = generation;
    if (!await initialize() || current !== generation) return false;
    // Native window close/quit must also commit inputs that have not blurred yet.
    for (const commit of editors) if (!await commit()) return false;
    while (updates.size > 0) await Promise.all([...updates]);
    if (!await flushUpdates()) return false;
    if (current !== generation) return false;
    return persist();
}

function persist(): Promise<boolean> {
    return settings.isDirty() ? request(() => window.api.settings.save()) : Promise.resolve(true);
}

export function dispose(): void {
    generation++;
    unsubscribe?.();
    unsubscribe = null;
    initialization = null;
    settings.setSnapshot(null);
    settings.setPendingPatch({});
    updateTask = null;
    settings.setError(null);
    editors.clear();
    updates.clear();
    notify();
}