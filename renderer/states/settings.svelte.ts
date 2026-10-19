import { type FailureInfo, toFailureInfo } from "../../shared/failure";
import { type Settings, type SettingsPatch, type SettingsResult, type SettingsSnapshot } from "../../shared/settings/Settings";
import { defaultSettings } from "../../shared/settings/defaults";
import { SvelteSet } from "svelte/reactivity";

let snapshot = $state.raw<SettingsSnapshot | null>(null);
let error = $state<FailureInfo | null>(null);
let initialization: Promise<boolean> | null = null;
let unsubscribe: (() => void) | null = null;
let generation = 0;
let pendingPatch = $state.raw<SettingsPatch>({});
let updateTask: Promise<boolean> | null = null;
const listeners = new SvelteSet<(value: Settings | null) => void>();
const editors = new SvelteSet<() => Promise<boolean>>();
const updates = new SvelteSet<Promise<boolean>>();

export function get(): Settings | null {
    return snapshot?.settings ?? null;
}

export function getVolumeStabilization(): Settings["volumeStabilization"] {
    return snapshot?.settings.volumeStabilization ?? defaultSettings.volumeStabilization;
}

export function isReady(): boolean {
    return snapshot !== null;
}

export function isDirty(): boolean {
    return Object.keys(pendingPatch).length > 0 || (snapshot?.dirty ?? false);
}

export function isSaving(): boolean {
    return snapshot?.saving ?? false;
}

export function getError(): FailureInfo | null {
    return error ?? snapshot?.error ?? null;
}

function notify(): void {
    for (const listener of listeners) {
        try {
            listener(get());
        }
        catch (error) {
            console.error(error);
        }
    }
}

function accept(next: SettingsSnapshot, current: number): void {
    if (current !== generation || (snapshot !== null && next.revision < snapshot.revision)) return;
    Object.freeze(next.settings.theme.light);
    Object.freeze(next.settings.theme.dark);
    Object.freeze(next.settings.theme);
    for (const preset of Object.values(next.settings.transcription.presets)) {
        Object.freeze(preset.params);
        Object.freeze(preset);
    }
    Object.freeze(next.settings.transcription.presets);
    Object.freeze(next.settings.transcription);
    Object.freeze(next.settings.editing);
    Object.freeze(next.settings.volumeStabilization);
    Object.freeze(next.settings.window);
    Object.freeze(next.settings.layout);
    Object.freeze(next.settings.playback);
    Object.freeze(next.settings);
    snapshot = next;
    notify();
}

export function subscribe(listener: (value: Settings | null) => void): () => void {
    listeners.add(listener);
    listener(get());
    return () => listeners.delete(listener);
}

export function initialize(): Promise<boolean> {
    if (initialization) return initialization;
    if (snapshot) return Promise.resolve(true);
    const current = generation;
    const operation = Promise.resolve().then(async () => {
        try {
            error = null;
            unsubscribe ??= window.api.settings.onChanged(next => accept(next, current));
            accept(await window.api.settings.get(), current);
            return current === generation && isReady();
        }
        catch (cause) {
            if (current === generation) error = toFailureInfo(cause);
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
        error = null;
        const result = await action();
        if (current !== generation) return false;
        accept(result.snapshot, current);
        if (!result.success) error = result.error;
        return result.success;
    }
    catch (cause) {
        if (current === generation) error = toFailureInfo(cause);
        return false;
    }
}

// Updating is independent of persistence; settings forms explicitly request an immediate save.
export function update(patch: SettingsPatch, options: { save?: boolean } = {}): Promise<boolean> {
    // Merge only supplied fields so startup loading and older IPC replies cannot overwrite newer edits.
    pendingPatch = {
        ...pendingPatch, ...patch,
        ...(patch.theme ? { theme: { ...pendingPatch.theme, ...patch.theme } } : {}),
        ...(patch.transcription ? { transcription: { ...pendingPatch.transcription, ...patch.transcription } } : {}),
        ...(patch.editing ? { editing: { ...pendingPatch.editing, ...patch.editing } } : {}),
        ...(patch.volumeStabilization ? { volumeStabilization: { ...pendingPatch.volumeStabilization, ...patch.volumeStabilization } } : {}),
        ...(patch.layout ? { layout: { ...pendingPatch.layout, ...patch.layout } } : {}),
        ...(patch.playback ? { playback: { ...pendingPatch.playback, ...patch.playback } } : {})
    };
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

export function getSidebarWidth(): number | null {
    return pendingPatch.layout?.sidebarWidth ?? snapshot?.settings.layout.sidebarWidth ?? defaultSettings.layout.sidebarWidth;
}

export function getVideoHeight(): number | null {
    const height = pendingPatch.layout?.videoHeight;
    return height !== undefined ? height : snapshot?.settings.layout.videoHeight ?? defaultSettings.layout.videoHeight;
}

export function getEditing(): Settings["editing"] {
    return { ...defaultSettings.editing, ...snapshot?.settings.editing, ...pendingPatch.editing };
}

export function getPlayback(): Settings["playback"] {
    return { ...defaultSettings.playback, ...snapshot?.settings.playback, ...pendingPatch.playback };
}

function flushUpdates(): Promise<boolean> {
    if (updateTask) return updateTask;
    const current = generation;
    const operation = Promise.resolve().then(async () => {
        while (current === generation && Object.keys(pendingPatch).length > 0) {
            const patch = pendingPatch;
            if (!await request(() => window.api.settings.update(patch)) || current !== generation) return false;
            // Coalesce changes made during IPC and keep the latest values visible.
            if (pendingPatch === patch) pendingPatch = {};
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
    return isDirty() ? request(() => window.api.settings.save()) : Promise.resolve(true);
}

export function dispose(): void {
    generation++;
    unsubscribe?.();
    unsubscribe = null;
    initialization = null;
    snapshot = null;
    pendingPatch = {};
    updateTask = null;
    error = null;
    editors.clear();
    updates.clear();
    notify();
}