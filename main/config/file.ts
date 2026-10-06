import { readFileSync } from "node:fs";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { type Config } from "../../shared/config/Config";
import { normalizeConfig } from "./validate";

export function readConfig(path: string): { config: Config; savedText: string | null } {
    let value: unknown;
    try {
        value = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
    }
    catch {
        // Reading never writes, creates backups or reports recovery warnings.
        value = null;
    }
    const config = normalizeConfig(value);
    return { config, savedText: isDeepStrictEqual(value, config) ? JSON.stringify(config) : null };
}

export async function writeConfig(path: string, text: string): Promise<void> {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });
    const temporary = join(directory, `.config-${randomUUID()}.tmp`);
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