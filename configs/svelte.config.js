import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
    preprocess: vitePreprocess(),
    compilerOptions: {
        runes: true,
        experimental: { async: true },
        warningFilter: (warning) => !warning.code.startsWith("a11y_")
    }
};