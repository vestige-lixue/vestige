import { shell, type WebContents } from "electron";
import { documentationChannels, parseDocumentLink } from "../../shared/documentation";
import { type AbsolutePath } from "../../shared/util/path";
import { readDocumentation, readDocumentationLink } from "./file";

export function registerDocumentationIPCs(contents: WebContents, root: AbsolutePath, ready: Promise<void>): void {
    contents.ipc.handle(documentationChannels.read, async (event, kind: unknown, language: unknown) => {
        if (event.senderFrame !== contents.mainFrame) throw new Error("Invalid IPC frame.");
        await ready;
        return readDocumentation(root, kind, language);
    });
    contents.ipc.handle(documentationChannels.readLink, async (event, from: unknown, href: unknown) => {
        if (event.senderFrame !== contents.mainFrame) throw new Error("Invalid IPC frame.");
        await ready;
        return readDocumentationLink(root, from, href);
    });
    contents.ipc.handle(documentationChannels.openExternal, async (event, url: unknown) => {
        if (event.senderFrame !== contents.mainFrame) throw new Error("Invalid IPC frame.");
        const link = typeof url === "string" ? parseDocumentLink(url) : null;
        if (!link || link.kind !== "url") throw new Error("Unsupported documentation URL.");
        await shell.openExternal(link.url);
    });
}