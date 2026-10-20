import { type FailureInfo } from "../../shared/failure";
import { type Settings, type SettingsPatch, type SettingsSnapshot } from "../../shared/settings/Settings";
import { defaultSettings } from "../../shared/settings/defaults";

let snapshot = $state.raw<SettingsSnapshot | null>(null);
let error = $state<FailureInfo | null>(null);
let pendingPatch = $state.raw<SettingsPatch>({});

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

export function getSnapshot(): SettingsSnapshot | null {
    return snapshot;
}

export function setSnapshot(value: SettingsSnapshot | null): void {
    snapshot = value;
}

export function getPendingPatch(): SettingsPatch {
    return pendingPatch;
}

export function setPendingPatch(value: SettingsPatch): void {
    pendingPatch = value;
}

export function setError(value: FailureInfo | null): void {
    error = value;
}