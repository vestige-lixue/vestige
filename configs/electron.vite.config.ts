import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import UnpluginTypia from "@typia/unplugin/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
    main: {
        plugins: [UnpluginTypia({ tsconfig: "configs/tsconfig.node.json", typia: { undefined: false } })],
        build: {
            outDir: "dist/main",
            rollupOptions: {
                input: resolve("main/index.ts")
            }
        }
    },
    preload: {
        esbuild: {
            // Erase inline type imports so the sandbox does not try to require their modules.
            tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: false } }
        },
        build: {
            outDir: "dist/preload",
            rollupOptions: {
                input: resolve("preload/index.ts"),
                output: {
                    format: "cjs",
                    entryFileNames: "index.cjs"
                }
            }
        }
    },
    renderer: {
        root: "renderer",
        publicDir: "../static",
        base: "./",
        server: {
            host: "127.0.0.1",
            port: 14200,
            strictPort: true
        },
        build: {
            outDir: "dist/renderer",
            rollupOptions: {
                input: resolve("renderer/index.html")
            }
        },
        plugins: [
            UnpluginTypia({
                tsconfig: "configs/tsconfig.web.json",
                // Validators live in TypeScript modules; component text can mention typia.
                include: [/\.[cm]?tsx?$/],
                typia: { undefined: false }
            }),
            svelte({ configFile: resolve("configs/svelte.config.js") })
        ]
    }
});