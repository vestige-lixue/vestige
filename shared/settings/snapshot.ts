import { type SettingsSnapshot } from "./Settings";

// Freeze published snapshots only. Editors own mutable drafts and patches.
export function freezeSnapshot(snapshot: SettingsSnapshot): SettingsSnapshot {
    const freeze = (value: unknown): void => {
        if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    };
    freeze(snapshot);
    return snapshot;
}