import { type FailureInfo } from "../../shared/failure";
import { type Settings, type SettingsPatch, type SettingsSnapshot } from "../../shared/settings/Settings";
import { defaultSettings } from "../../shared/settings/defaults";
import { mergeSettings } from "../../shared/settings/merge";

let snapshot = $state.raw<SettingsSnapshot | null>(null);
let error = $state<FailureInfo | null>(null);
let pendingPatch = $state.raw<SettingsPatch>({});
let inFlightPatch = $state.raw<SettingsPatch>({});
const current = $derived(mergeSettings(mergeSettings(snapshot?.settings ?? defaultSettings, inFlightPatch), pendingPatch));

export function getConfirmed(): Settings | null {
    return snapshot?.settings ?? null;
}

export function getCurrent(): Settings {
    return current;
}

export function getVolumeStabilization(): Settings["volumeStabilization"] {
    return current.volumeStabilization;
}

export function isReady(): boolean {
    return snapshot !== null;
}

export function isDirty(): boolean {
    return Object.keys(pendingPatch).length > 0 || Object.keys(inFlightPatch).length > 0 || (snapshot?.dirty ?? false);
}

export function isSaving(): boolean {
    return snapshot?.saving ?? false;
}

export function getError(): FailureInfo | null {
    return error ?? snapshot?.error ?? null;
}

export function getSidebarWidth(): number | null {
    return current.layout.sidebarWidth;
}

export function getVideoHeight(): number | null {
    return current.layout.videoHeight;
}

export function getEditing(): Settings["editing"] {
    return current.editing;
}

export function getPlayback(): Settings["playback"] {
    return current.playback;
}

export function getConfirmedPlayback(): Settings["playback"] {
    return snapshot?.settings.playback ?? defaultSettings.playback;
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

export function setInFlightPatch(value: SettingsPatch): void {
    inFlightPatch = value;
}

export function setError(value: FailureInfo | null): void {
    error = value;
}