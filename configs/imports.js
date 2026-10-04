import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

export default {
    rules: {
        "svelte-namespace": {
            meta: {
                type: "suggestion",
                schema: [],
                messages: {
                    namespace: "Import .svelte.ts modules with import * as {{name}}; use the file's base name as the namespace."
                }
            },
            create(context) {
                return {
                    ImportDeclaration(node) {
                        const source = node.source.value;
                        if (!/\.svelte(?:\.ts)?$/u.test(source)) return;
                        if (!source.endsWith(".ts") && !existsSync(resolve(dirname(context.filename), source + ".ts"))) return;
                        const name = basename(source).replace(/\.svelte(?:\.ts)?$/u, "");
                        const specifier = node.specifiers[0];
                        if (node.importKind !== "type" && node.specifiers.length === 1
                            && specifier.type === "ImportNamespaceSpecifier" && specifier.local.name === name) return;
                        context.report({ node, messageId: "namespace", data: { name } });
                    }
                };
            }
        }
    }
};