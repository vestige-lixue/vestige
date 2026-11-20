import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { type Settings } from "../../shared/settings/Settings";
import { defaultSettings } from "../../shared/settings/defaults";
import { themeSchemes } from "../../shared/theme";
import { parseSettings } from "./validate";
import { decodeUTF8, parseJSON } from "../util/data";
import { errorCode, fileOperationFailure, writeFileAtomic } from "../util/fs";
import { type FailureInfo, isExpectedFailure } from "../../shared/failure";

export function readSettings(path: string, preferredLanguages: readonly string[] = []): { settings: Settings; savedText: string | null; loadError: FailureInfo | null } {
    const fallback = (loadError: FailureInfo | null): ReturnType<typeof readSettings> => {
        const language = preferredLanguages.map(language => language.split("-")[0]?.toLowerCase())
            .find(language => language === "zh" || language === "en");
        return { settings: { ...structuredClone(defaultSettings), language: language === "zh" ? "zh-CN" : "en" }, savedText: null, loadError };
    };
    // Reading never writes or creates backups.
    let bytes: Buffer;
    try {
        bytes = readFileSync(path);
    }
    catch (error) {
        return fallback(errorCode(error) === "ENOENT" ? null : fileOperationFailure(error as NodeJS.ErrnoException, "read", path));
    }
    try {
        const value = parseJSON(decodeUTF8(bytes));
        const savedText = JSON.stringify(value);
        return { settings: parseSettings(normalizeSettings(value)), savedText, loadError: null };
    }
    catch (error) {
        if (!isExpectedFailure(error)) throw error;
        return fallback(error.failure);
    }
}

export function normalizeSettings(value: unknown): unknown {
    if (value && typeof value === "object" && "editing" in value && value.editing && typeof value.editing === "object") {
        if ("spellcheck" in value.editing) delete value.editing.spellcheck;
        for (const key of ["followPlayback", "hideTrivialInformation", "referenceOverlap", "referenceTranscriptPosition"] as const) {
            if (!(key in value.editing)) Object.assign(value.editing, { [key]: defaultSettings.editing[key] });
        }
    }
    // Version 1.0.0 and earlier stored neither reference column visibility nor its width.
    if (value && typeof value === "object" && "layout" in value && value.layout && typeof value.layout === "object") {
        for (const key of ["showReferenceTranscript", "referenceTranscriptRatio"] as const) {
            if (!(key in value.layout)) Object.assign(value.layout, { [key]: defaultSettings.layout[key] });
        }
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
    // 0.5.1 settings also predate the rewind amounts; saved values override these defaults.
    if (value && typeof value === "object" && "playback" in value && value.playback && typeof value.playback === "object") {
        const { rewindStepMs, startRewindMs } = defaultSettings.playback;
        value.playback = { rewindStepMs, startRewindMs, ...value.playback };
    }
    if (value && typeof value === "object" && !("export" in value)) {
        value = { ...value, export: structuredClone(defaultSettings.export) };
    }
    if (value && typeof value === "object" && "export" in value && value.export && typeof value.export === "object"
        && "srt" in value.export && value.export.srt && typeof value.export.srt === "object" && !("splitAtSentenceEnds" in value.export.srt)) {
        value.export.srt = { ...value.export.srt, splitAtSentenceEnds: defaultSettings.export.srt.splitAtSentenceEnds };
    }
    // Discard removed SRT controls before strict validation, preserving other preferences.
    if (value && typeof value === "object" && "export" in value && value.export && typeof value.export === "object"
        && "srt" in value.export && value.export.srt && typeof value.export.srt === "object") {
        if ("tokenBasis" in value.export.srt) delete value.export.srt.tokenBasis;
        if ("maxTokens" in value.export.srt) delete value.export.srt.maxTokens;
    }
    return value;
}

export async function writeSettings(path: string, text: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFileAtomic(path, text, { sync: true, mode: undefined });
}