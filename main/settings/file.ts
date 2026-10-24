import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { type Settings } from "../../shared/settings/Settings";
import { defaultSettings } from "../../shared/settings/defaults";
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
    if (validSettings(value)) return { settings: value, savedText };
    return { settings: structuredClone(defaultSettings), savedText: null };
}

export async function writeSettings(path: string, text: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFileAtomic(path, text, { sync: true, mode: undefined });
}