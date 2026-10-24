import { defineConfig } from "eslint/config";
import tseslint from "@electron-toolkit/eslint-config-ts";
import eslintPluginSvelte from "eslint-plugin-svelte";
import stylistic from "@stylistic/eslint-plugin";
import css from "@eslint/css";
import json from "@eslint/json";
import yml from "eslint-plugin-yml";
import local from "./css.js";
import imports from "./imports.js";

export default defineConfig(
    { ignores: ["**/node_modules", "**/dist", "**/build", "**/.local", "pnpm-lock.yaml"] },
    {
        files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,svelte}"],
        extends: [
            tseslint.configs.recommended,
            eslintPluginSvelte.configs["flat/recommended"]
        ],
        plugins: { "@stylistic": stylistic, imports },
        rules: {
            "imports/svelte-namespace": "error",
            "no-unused-vars": "warn",
            "@typescript-eslint/no-unused-vars": "off",
            "no-restricted-syntax": ["warn", {
                selector: "ImportDeclaration[importKind='type']",
                message: "Put type inside the braces: import { type Foo } from \"./Foo\"."
            }, {
                selector: "Property[kind=/^(get|set)$/], MethodDefinition[kind=/^(get|set)$/], AccessorProperty",
                message: "Use ordinary functions instead of get/set accessors; export state operations as individual functions."
            }],
            "@stylistic/quotes": ["warn", "double", { avoidEscape: false, allowTemplateLiterals: "always" }],
            "@stylistic/semi": ["warn", "always"],
            "@stylistic/comma-dangle": ["warn", "never"],
            "@stylistic/arrow-spacing": ["warn", { before: true, after: true }],
            "@stylistic/brace-style": ["warn", "stroustrup"]
        }
    },
    {
        files: ["**/*.{ts,mts,cts,tsx,svelte}"],
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "warn"
        }
    },
    {
        files: ["**/*.{ts,mts,cts,tsx}"],
        rules: {
            "@stylistic/indent": ["warn", 4]
        }
    },
    {
        files: ["**/*.{js,mjs,cjs,jsx}"],
        rules: {
            "@typescript-eslint/explicit-function-return-type": "off"
        }
    },
    {
        files: ["**/*.svelte"],
        rules: {
            "svelte/indent": ["warn", { indent: 4 }],
            "svelte/no-restricted-html-elements": ["error", {
                elements: ["p"],
                message: "Use div, or main/nav/footer/section/article/aside when semantically appropriate."
            }]
        },
        languageOptions: {
            parserOptions: { parser: tseslint.parser }
        }
    },
    {
        files: ["**/*.svelte.ts"],
        languageOptions: { parser: tseslint.parser }
    },
    {
        files: ["**/*.{tsx,svelte}"],
        rules: {
            "svelte/no-unused-svelte-ignore": "off"
        }
    },
    {
        files: ["**/*.css"],
        plugins: { css },
        language: "css/css"
    },
    {
        files: ["**/*.{css,svelte}"],
        plugins: { local },
        rules: {
            "local/css-quotes": "warn",
            "local/css-semi": "warn"
        }
    },
    {
        files: ["**/*.json"],
        plugins: { json },
        language: "json/json",
        extends: ["json/recommended"]
    },
    {
        files: ["**/*.jsonc", "**/tsconfig*.json", ".vscode/*.json"],
        plugins: { json },
        language: "json/jsonc",
        languageOptions: { allowTrailingCommas: false },
        extends: ["json/recommended"]
    },
    yml.configs["flat/recommended"],
    {
        files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,svelte,css,json,jsonc,yaml,yml}"],
        plugins: { "@stylistic": stylistic },
        rules: {
            "@stylistic/eol-last": ["warn", "never"],
            "@stylistic/no-trailing-spaces": "warn"
        }
    }
);