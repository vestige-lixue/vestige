import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import UnpluginTypia from "@typia/unplugin/vite";

export default defineConfig({
    root: resolve(import.meta.dirname, ".."),
    plugins: [UnpluginTypia({
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