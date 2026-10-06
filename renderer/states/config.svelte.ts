import { type Failure, toFailure } from "../../shared/failure";
import { type Config, type ConfigPatch, type ConfigResult, type ConfigSnapshot, type PlaybackConfigPatch } from "../../shared/config/Config";
import { defaultConfig, validSidebarWidth } from "../../shared/config/defaults";
import { SvelteSet } from "svelte/reactivity";

let snapshot = $state.raw<ConfigSnapshot | null>(null);
let error = $state<Failure | null>(null);
let initialization: Promise<boolean> | null = null;
let unsubscribe: (() => void) | null = null;
let generation = 0;
let pendingSidebarWidth = $state<number | null>(null);
let sidebarUpdate: Promise<boolean> | null = null;
let pendingPlayback = $state.raw<PlaybackConfigPatch>({});
let playbackUpdate: Promise<boolean> | null = null;
const playbackDefaults = defaultConfig().playback;
const listeners = new SvelteSet<(value: Config | null) => void>();

export function get(): Config | null {
    return snapshot?.config ?? null;
}

export function isReady(): boolean {
    return snapshot !== null;
}

export function isDirty(): boolean {
    return (pendingSidebarWidth !== null && pendingSidebarWidth !== snapshot?.config.layout.sidebarWidth)
        || Object.entries(pendingPlayback).some(([key, value]) => value !== snapshot?.config.playback[key as keyof PlaybackConfigPatch])
        || (snapshot?.dirty ?? false);
}

export function isSaving(): boolean {
    return snapshot?.saving ?? false;
}

export function getError(): Failure | null {
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

function accept(next: ConfigSnapshot, current: number): void {
    if (current !== generation || (snapshot !== null && next.revision < snapshot.revision)) return;
    Object.freeze(next.config.transcription);
    Object.freeze(next.config.window);
    Object.freeze(next.config.layout);
    Object.freeze(next.config.playback);
    Object.freeze(next.config);
    snapshot = next;
    notify();
}

export function subscribe(listener: (value: Config | null) => void): () => void {
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
            unsubscribe ??= window.api.config.onChanged(next => accept(next, current));
            accept(await window.api.config.get(), current);
            return current === generation && isReady();
        }
        catch (cause) {
            if (current === generation) error = toFailure(cause);
            return false;
        }
    }).finally(() => {
        if (initialization === operation) initialization = null;
    });
    initialization = operation;
    return initialization;
}

async function request(action: () => Promise<ConfigResult>): Promise<boolean> {
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
        if (current === generation) error = toFailure(cause);
        return false;
    }
}

export function update(patch: ConfigPatch): Promise<boolean> {
    return request(() => window.api.config.update(patch));
}

export function setTranscriptionConcurrency(concurrency: number): Promise<boolean> {
    return update({ transcription: { concurrency } });
}

export function getSidebarWidth(): number | null {
    return pendingSidebarWidth ?? snapshot?.config.layout.sidebarWidth ?? null;
}

export function setSidebarWidth(width: number): Promise<boolean> {
    if (!validSidebarWidth(width)) {
        error = { kind: "config-invalid-sidebar-width" };
        return Promise.resolve(false);
    }
    // Keep dragging responsive while IPC replies arrive; older replies must not
    // replace a more recent pointer/keyboard adjustment or the startup override.
    pendingSidebarWidth = width;
    const operation = request(() => window.api.config.setSidebarWidth(width)).finally(() => {
        if (sidebarUpdate !== operation) return;
        pendingSidebarWidth = null;
        sidebarUpdate = null;
    });
    sidebarUpdate = operation;
    return operation;
}

export function getPlayback(): Config["playback"] {
    return { ...playbackDefaults, ...snapshot?.config.playback, ...pendingPlayback };
}

export function updatePlayback(patch: PlaybackConfigPatch): Promise<boolean> {
    // Overlay only changed fields so startup loading preserves the other saved values.
    pendingPlayback = { ...pendingPlayback, ...patch };
    return flushPlayback();
}

function flushPlayback(): Promise<boolean> {
    if (playbackUpdate) return playbackUpdate;
    const current = generation;
    const operation = Promise.resolve().then(async () => {
        while (current === generation && Object.keys(pendingPlayback).length > 0) {
            const patch = pendingPlayback;
            if (!await request(() => window.api.config.updatePlayback(patch)) || current !== generation) return false;
            // Coalesce changes made during IPC and keep the latest values visible.
            if (pendingPlayback === patch) pendingPlayback = {};
        }
        return current === generation;
    }).finally(() => {
        if (playbackUpdate === operation) playbackUpdate = null;
    });
    playbackUpdate = operation;
    return operation;
}

export async function save(): Promise<boolean> {
    const current = generation;
    if (sidebarUpdate && !await sidebarUpdate) return false;
    if (!await flushPlayback()) return false;
    if (current !== generation) return false;
    return request(() => window.api.config.save());
}

export function dispose(): void {
    generation++;
    unsubscribe?.();
    unsubscribe = null;
    initialization = null;
    snapshot = null;
    pendingSidebarWidth = null;
    sidebarUpdate = null;
    pendingPlayback = {};
    playbackUpdate = null;
    error = null;
    notify();
}