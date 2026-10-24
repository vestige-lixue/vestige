import { shell, type WebContents } from "electron";
import { documentationChannels, parseDocumentLink, type Documentation, type DocumentationResult } from "../../shared/documentation";
import { type AbsolutePath } from "../../shared/util/path";
import { readDocumentation, readDocumentationLink } from "./file";
import { isExpectedFailure, type OperationResult } from "../../shared/failure";
import { handle } from "../util/ipc";

export function registerDocumentationIPCs(contents: WebContents, root: AbsolutePath, ready: Promise<void>): void {
    const read = async (operation: () => Promise<Documentation>): Promise<DocumentationResult> => {
        try {
            await ready;
            return { success: true, document: await operation() };
        }
        catch (error) {
            if (isExpectedFailure(error)) return { success: false, error: error.failure };
            throw error;
        }
    };
    handle(contents, documentationChannels.read, (kind: unknown, language: unknown) => read(() => readDocumentation(root, kind, language)));
    handle(contents, documentationChannels.readLink, (from: unknown, href: unknown) => read(() => readDocumentationLink(root, from, href)));
    handle(contents, documentationChannels.openExternal, async (url: unknown): Promise<OperationResult> => {
        const link = typeof url === "string" ? parseDocumentLink(url) : null;
        if (!link || link.kind !== "url") return { success: false, error: { kind: "documentation-invalid-request", reason: "link" } };
        try {
            await shell.openExternal(link.url);
            return { success: true };
        }
        catch (error) {
            // This boundary owns the external shell operation and preserves its diagnostic.
            return { success: false, error: { kind: "external-open-failed", url: link.url, diagnostic: error instanceof Error ? error.message : String(error) } };
        }
    });
}