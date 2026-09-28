import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
    main: {
        build: {
            outDir: "dist/main",
            rollupOptions: {
                input: resolve("main/index.ts")
            }
        }
    },
    preload: {
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
        plugins: [svelte({ configFile: resolve("configs/svelte.config.js") })]
    }
});