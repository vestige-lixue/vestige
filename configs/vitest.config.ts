import { resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { defineConfig } from "vitest/config";
import UnpluginTypia from "@typia/unplugin/vite";

const sharedDirectory = resolve(import.meta.dirname, "../shared");
const schema = createHash("sha256");
for (const file of readdirSync(sharedDirectory, { recursive: true, encoding: "utf8" }).filter(file => file.endsWith(".ts")).sort()) {
    schema.update(file).update(readFileSync(resolve(sharedDirectory, file)));
}
const schemaKey = schema.digest("hex");

export default defineConfig({
    root: resolve(import.meta.dirname, ".."),
    plugins: [{
        name: "typia-live-type-contracts",
        configureVitest({ defineCacheKeyGenerator }) {
            // Generated guards depend on types erased from the runtime import graph.
            defineCacheKeyGenerator(({ id }) => /[/\\](?:main[/\\]project[/\\]validate|shared[/\\]media[/\\]check)\.ts$/.test(id) ? schemaKey : undefined);
        }
    }, UnpluginTypia({
        tsconfig: resolve(import.meta.dirname, "tsconfig.test.json"),
        typia: { undefined: false },
        include: [/[/\\]main[/\\]project[/\\]validate\.ts$/, /[/\\]shared[/\\]media[/\\]check\.ts$/]
    })],
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        fileParallelism: false
    }
});