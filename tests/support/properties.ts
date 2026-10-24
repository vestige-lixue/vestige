import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import * as fc from "fast-check";

export function checkProperty<T extends unknown[]>(name: string, property: fc.IProperty<T>): void {
    const seed = Number(process.env.VESTIGE_TEST_SEED ?? 20261024);
    if (!Number.isSafeInteger(seed)) throw new Error("VESTIGE_TEST_SEED must be an integer.");
    const result = fc.check(property, {
        seed,
        numRuns: 200,
        ...(process.env.VESTIGE_TEST_PATH ? { path: process.env.VESTIGE_TEST_PATH } : {})
    });
    if (!result.failed) return;
    const directory = resolve(".local", "w1-test-failures");
    mkdirSync(directory, { recursive: true });
    const path = join(directory, name + "-" + randomUUID() + ".json");
    writeFileSync(path, JSON.stringify({
        property: name,
        seed: result.seed,
        path: result.counterexamplePath,
        counterexample: result.counterexample,
        numRuns: result.numRuns,
        numShrinks: result.numShrinks,
        error: result.errorInstance instanceof Error ? result.errorInstance.stack : String(result.errorInstance)
    }, null, 4), "utf8");
    throw new Error("Property failed; seed " + result.seed + ", path " + result.counterexamplePath + "; saved " + path, {
        cause: result.errorInstance
    });
}