import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSettings } from "../main/settings/file";
import { validSettings } from "../main/settings/validate";
import { defaultSettings } from "../shared/settings/defaults";

type JSONRecord = { [key: string]: unknown };
const releases = ["v0.5.0", "v0.6.0", "v0.7.0", "v0.8.0", "v0.8.1", "v1.0.0", "v1.1.0"];
const directories: string[] = [];
const invalidUTF8 = Buffer.from(JSON.stringify({
    ...defaultSettings,
    transcription: { ...defaultSettings.transcription, presets: {
        A: { executor: "whisper.cpp", backendDirectory: "A", modelDirectory: "B", params: { prompt: "invalid-byte" } }
    } }
}));
invalidUTF8[invalidUTF8.indexOf("invalid-byte")] = 0xff;

function temporaryPath(): string {
    const directory = mkdtempSync(join(tmpdir(), "vestige-settings-"));
    directories.push(directory);
    return join(directory, "settings.json");
}

function record(value: unknown): value is JSONRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

// List removed fields explicitly: an accidental migration must not change this oracle.
function retainedFields(sample: JSONRecord): JSONRecord {
    const retained = structuredClone(sample);
    const editing = retained.editing as JSONRecord;
    delete editing.spellcheck;
    const theme = retained.theme as Record<string, JSONRecord>;
    for (const palette of [theme.light, theme.dark]) {
        delete palette["--c-surface"];
        delete palette["--c-text-80p"];
        delete palette["--c-audio-level"];
    }
    if (record(retained.export) && record(retained.export.srt)) {
        delete retained.export.srt.tokenBasis;
        delete retained.export.srt.maxTokens;
    }
    return retained;
}

// Theme palettes hold overrides, so an empty palette stays empty instead of receiving default colors.
const overrideMaps = new Set(["theme.light", "theme.dark"]);

function withMissingDefaults(sample: JSONRecord, defaults: JSONRecord, path = ""): JSONRecord {
    return Object.fromEntries(Object.entries({ ...defaults, ...sample }).map(([key, value]) => {
        const field = path ? `${path}.${key}` : key;
        return [key, record(value) && record(defaults[key]) && !overrideMaps.has(field) ? withMissingDefaults(value, defaults[key], field) : value];
    }));
}

afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("settings file reading and upgrade", () => {
    it.each(releases)("preserves %s preferences and fills only missing fields", release => {
        const path = new URL(`./support/settings/${release}.json`, import.meta.url);
        const bytes = readFileSync(path);
        const sample = JSON.parse(bytes.toString("utf8")) as JSONRecord;
        const loaded = readSettings(fileURLToPath(path), ["zh-CN"]);
        const retained = retainedFields(sample);
        expect(loaded.loadError).toBeNull();
        expect(validSettings(loaded.settings)).toBe(true);
        expect(loaded.settings).toEqual(withMissingDefaults(retained, defaultSettings));
        expect(readFileSync(path)).toEqual(bytes);
    });

    it("fills only the missing reference preferences when upgrading a settings file", () => {
        const path = temporaryPath();
        const previous = JSON.parse(readFileSync(new URL("./support/settings/v1.0.0.json", import.meta.url), "utf8"));
        previous.editing.referenceTranscriptPosition = "left";
        previous.layout.referenceTranscriptRatio = 0.7;
        writeFileSync(path, JSON.stringify(previous));
        const loaded = readSettings(path);
        expect(loaded.loadError).toBeNull();
        expect(loaded.settings).toEqual({ ...previous, layout: { ...previous.layout, showReferenceTranscript: false } });
    });

    it("round-trips the current defaults", () => {
        const path = temporaryPath();
        writeFileSync(path, JSON.stringify(defaultSettings, null, 4));
        const loaded = readSettings(path, ["zh-CN"]);
        expect(loaded.loadError).toBeNull();
        expect(loaded.settings).toEqual(defaultSettings);
        expect(loaded.savedText).toBe(JSON.stringify(defaultSettings));
    });

    it("accepts a UTF-8 BOM", () => {
        const path = temporaryPath();
        writeFileSync(path, `\uFEFF${JSON.stringify(defaultSettings, null, 4)}`);
        const loaded = readSettings(path, ["en"]);
        expect(loaded.loadError).toBeNull();
        expect(loaded.settings).toEqual(defaultSettings);
    });

    it("discards the removed SRT controls while retaining other export preferences", () => {
        const path = temporaryPath();
        const settings = { ...defaultSettings, export: { ...defaultSettings.export, srt: { ...defaultSettings.export.srt, maxLines: 3 } } };
        writeFileSync(path, JSON.stringify({ ...settings, export: { ...settings.export, srt: { ...settings.export.srt, tokenBasis: "word", maxTokens: 10 } } }));
        const loaded = readSettings(path);
        expect(loaded.loadError).toBeNull();
        expect(loaded.settings).toEqual(settings);
    });

    it.each([
        { label: "invalid JSON", bytes: Buffer.from("{ invalid JSON"), error: { kind: "invalid-json" } },
        { label: "a newer settings version", bytes: Buffer.from(JSON.stringify({ ...defaultSettings, version: 2, futureSetting: true })), error: { kind: "unsupported-version", file: "settings", version: "2" } },
        { label: "an unknown field from a newer version", bytes: Buffer.from(JSON.stringify({ ...defaultSettings, futureSetting: true })), error: { kind: "unknown-field", path: "settings.futureSetting" } },
        { label: "invalid UTF-8 bytes", bytes: invalidUTF8, error: { kind: "invalid-encoding" } },
        { label: "an invalid reference position", bytes: Buffer.from(JSON.stringify({ ...defaultSettings, editing: { ...defaultSettings.editing, referenceTranscriptPosition: "top" } })), error: { kind: "invalid-structure", path: "settings.editing.referenceTranscriptPosition" } },
        { label: "an out-of-range reference ratio", bytes: Buffer.from(JSON.stringify({ ...defaultSettings, layout: { ...defaultSettings.layout, referenceTranscriptRatio: 1 } })), error: { kind: "invalid-structure", path: "settings.layout.referenceTranscriptRatio" } },
        { label: "a field with the wrong type", bytes: Buffer.from(JSON.stringify({ ...defaultSettings, playback: { ...defaultSettings.playback, speed: "fast" } })), error: { kind: "invalid-structure", path: "settings.playback.speed" } }
    ])("reports $label without changing the original bytes", ({ bytes, error }) => {
        const path = temporaryPath();
        writeFileSync(path, bytes);
        const loaded = readSettings(path, ["zh-CN"]);
        expect(loaded.loadError).toMatchObject(error);
        expect(loaded.settings).toEqual(defaultSettings);
        expect(loaded.savedText).toBeNull();
        expect(readFileSync(path)).toEqual(bytes);
    });

    it("uses system-language defaults for missing files without creating one", () => {
        const path = temporaryPath();
        const loaded = readSettings(path, ["fr-FR", "en-US", "zh-CN"]);
        expect(loaded.loadError).toBeNull();
        expect(loaded.settings).toEqual({ ...defaultSettings, language: "en" });
        expect(loaded.savedText).toBeNull();
        expect(() => readFileSync(path)).toThrow();
    });

    it("reports a read failure separately from invalid content", () => {
        const path = temporaryPath();
        const loaded = readSettings(join(path, ".."), ["zh-CN"]);
        expect(loaded.loadError).toMatchObject({ kind: "file-operation-failed", operation: "read" });
        expect(loaded.settings).toEqual(defaultSettings);
        expect(loaded.savedText).toBeNull();
    });
});