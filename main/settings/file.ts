import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { type Settings } from "../../shared/settings/Settings";
import { defaultSettings } from "../../shared/settings/defaults";
import { themeSchemes } from "../../shared/theme";
import { validSettings } from "./validate";
import { writeFileAtomic } from "../util/fs";

export function readSettings(path: string): { settings: Settings; savedText: string | null } {
    let value: unknown;
    let savedText: string | null = null;
    try {
        value = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
        savedText = JSON.stringify(value);
    }
    catch {
        // Reading never writes, creates backups or reports recovery warnings.
        value = null;
    }
    // Spell checking was removed; discard its legacy field before strict validation.
    if (value && typeof value === "object" && "editing" in value && value.editing && typeof value.editing === "object"
        && "spellcheck" in value.editing) {
        delete value.editing.spellcheck;
    }
    // These colors are derived now. Discard only their legacy overrides before strict validation.
    if (value && typeof value === "object" && "theme" in value && value.theme && typeof value.theme === "object") {
        for (const scheme of themeSchemes) {
            const palette: unknown = (value.theme as Record<string, unknown>)[scheme];
            if (palette && typeof palette === "object") {
                if ("--c-surface" in palette) delete palette["--c-surface"];
                if ("--c-text-80p" in palette) delete palette["--c-text-80p"];
                if ("--c-audio-level" in palette) delete palette["--c-audio-level"];
            }
        }
    }
    // Older settings predate playback following; retain their other preferences.
    if (value && typeof value === "object" && "editing" in value && value.editing && typeof value.editing === "object"
        && !("followPlayback" in value.editing)) {
        value.editing = { ...value.editing, followPlayback: defaultSettings.editing.followPlayback };
    }
    if (value && typeof value === "object" && "editing" in value && value.editing && typeof value.editing === "object"
        && !("hideTrivialInformation" in value.editing)) {
        value.editing = { ...value.editing, hideTrivialInformation: defaultSettings.editing.hideTrivialInformation };
    }
    if (value && typeof value === "object" && "editing" in value && value.editing && typeof value.editing === "object"
        && !("referenceOverlap" in value.editing)) {
        value.editing = { ...value.editing, referenceOverlap: defaultSettings.editing.referenceOverlap };
    }
    // 0.5.1 settings also predate the rewind amounts; saved values override these defaults.
    if (value && typeof value === "object" && "playback" in value && value.playback && typeof value.playback === "object") {
        const { rewindStepMs, startRewindMs } = defaultSettings.playback;
        value.playback = { rewindStepMs, startRewindMs, ...value.playback };
    }
    if (validSettings(value)) return { settings: value, savedText };
    return { settings: structuredClone(defaultSettings), savedText: null };
}

export async function writeSettings(path: string, text: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFileAtomic(path, text, { sync: true, mode: undefined });
}