import { toFailureInfo } from "../../shared/failure";
import { type Settings, type SettingsPatch, type SettingsResult, type SettingsSnapshot } from "../../shared/settings/Settings";
import { mergeSettings } from "../../shared/settings/merge";
import { freezeSnapshot } from "../../shared/settings/snapshot";
import { SvelteSet } from "svelte/reactivity";
import { tick } from "svelte";
import * as settings from "./settings.svelte";
import * as dialogs from "./dialogs.svelte";
import * as dialogsAPI from "./dialogs";

type SettingsDraft = { dialogId: string; commit: () => Promise<boolean> };
let initialization: Promise<boolean> | null = null;
let unsubscribe: (() => void) | null = null;
let generation = 0;
let updateTask: Promise<boolean> | null = null;
let queuedVersion = 0;
let acceptedVersion = 0;
const listeners = new SvelteSet<(value: Settings | null) => void>();
const editors = new SvelteSet<SettingsDraft>();

function notify(): void {
    for (const listener of listeners) {
        try {
            listener(settings.getConfirmed());
        }
        catch (error) {
            console.error(error);
        }
    }
}

function accept(next: SettingsSnapshot, current: number): void {
    const snapshot = settings.getSnapshot();
    if (current !== generation || (snapshot !== null && next.revision < snapshot.revision)) return;
    settings.setSnapshot(freezeSnapshot(next));
    notify();
}

export function subscribe(listener: (value: Settings | null) => void): () => void {
    listeners.add(listener);
    listener(settings.getConfirmed());
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
    return operation;
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

// A successful update means main accepted this independent patch. Disk writes
// are debounced there and report their errors in a separate snapshot field.
export async function update(patch: SettingsPatch): Promise<boolean> {
    if (Object.keys(patch).length === 0) return true;
    settings.setPendingPatch(mergeSettings(settings.getPendingPatch(), structuredClone(patch)));
    const version = ++queuedVersion;
    const current = generation;
    while (current === generation && acceptedVersion < version) {
        if (!await flushUpdates()) return false;
    }
    return current === generation;
}

export function registerDraft(draft: SettingsDraft): () => void {
    editors.add(draft);
    return () => editors.delete(draft);
}

function flushUpdates(): Promise<boolean> {
    if (updateTask) return updateTask;
    const current = generation;
    const operation = Promise.resolve().then(async () => {
        while (current === generation && Object.keys(settings.getPendingPatch()).length > 0) {
            const patch = settings.getPendingPatch();
            const version = queuedVersion;
            settings.setPendingPatch({});
            settings.setInFlightPatch(patch);
            const success = await request(() => window.api.settings.update(patch));
            if (current !== generation) return false;
            settings.setInFlightPatch({});
            if (!success) {
                settings.setPendingPatch(mergeSettings(patch, settings.getPendingPatch()));
                return false;
            }
            acceptedVersion = version;
        }
        return current === generation;
    }).finally(() => {
        if (updateTask === operation) updateTask = null;
    });
    updateTask = operation;
    return operation;
}

export async function commitDrafts(): Promise<boolean> {
    const current = generation;
    if (!await initialize() || current !== generation) return false;
    // Check the topmost editor first, so an invalid visible input keeps focus.
    const order = dialogs.state.dialogs.map(dialog => dialog.id);
    const drafts = [...editors].sort((left, right) => order.indexOf(right.dialogId) - order.indexOf(left.dialogId));
    try {
        for (const draft of drafts) {
            if (current !== generation) return false;
            if (await draft.commit()) continue;
            const index = dialogs.state.dialogs.findIndex(dialog => dialog.id === draft.dialogId);
            if (index >= 0) {
                const above = dialogs.state.dialogs.slice(index + 1).reverse();
                for (const dialog of above) {
                    if (!await dialogsAPI.requestClose(dialog.id)) return false;
                }
                if (above.length > 0 && current === generation && editors.has(draft)) {
                    await tick();
                    // The original validation already failed. Re-run only to
                    // restore its field focus after upper focus traps are gone.
                    await draft.commit();
                }
            }
            return false;
        }
        return current === generation && await flushUpdates();
    }
    catch (cause) {
        if (current === generation) settings.setError(toFailureInfo(cause));
        return false;
    }
}

export async function flush(): Promise<boolean> {
    const current = generation;
    if (!await commitDrafts() || current !== generation) return false;
    return flushAccepted();
}

export function flushAccepted(): Promise<boolean> {
    const snapshot = settings.getSnapshot();
    return snapshot ? request(() => window.api.settings.flush(snapshot.settingsRevision)) : Promise.resolve(false);
}

export function dispose(): void {
    generation++;
    unsubscribe?.();
    unsubscribe = null;
    initialization = null;
    settings.setSnapshot(null);
    settings.setPendingPatch({});
    settings.setInFlightPatch({});
    updateTask = null;
    queuedVersion = acceptedVersion = 0;
    settings.setError(null);
    editors.clear();
    notify();
}