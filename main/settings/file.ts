import { readFileSync } from "node:fs";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { type Settings } from "../../shared/settings/Settings";
import { defaultSettings } from "../../shared/settings/defaults";
import { validSettings } from "./validate";

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
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });
    const temporary = join(directory, `.settings-${randomUUID()}.tmp`);
    try {
        const handle = await open(temporary, "wx");
        try {
            await handle.writeFile(text, "utf8");
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        await rename(temporary, path);
    }
    finally {
        await rm(temporary, { force: true }).catch(console.error);
    }
}