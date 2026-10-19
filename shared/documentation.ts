export type DocumentationKind = "guide" | "params";

export type Documentation = { path: string; content: string };

export type DocumentLink = ({
    kind: "url";
    url: string;
} | {
    kind: "local";
    path: string;
    anchor: string;
});

export const documentationChannels = {
    read: "documentation:read",
    readLink: "documentation:read-link",
    openExternal: "documentation:open-external"
} as const;

function hasControlCharacters(value: string): boolean {
    return [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

export function parseDocumentLink(href: string): DocumentLink | null {
    const value = href.trim();
    if (!value || hasControlCharacters(value)) return null;
    if (/^https?:\/\//i.test(value)) {
        try {
            return { kind: "url", url: new URL(value).href };
        }
        catch {
            return null;
        }
    }
    const separator = value.indexOf("#");
    try {
        const path = decodeURIComponent(separator === -1 ? value : value.slice(0, separator)).replaceAll("\\", "/");
        const anchor = decodeURIComponent(separator === -1 ? "" : value.slice(separator + 1));
        if (hasControlCharacters(path) || /[:?#]/u.test(path) || path.startsWith("/") || (path && !/\.md$/i.test(path))) return null;
        return { kind: "local", path, anchor };
    }
    catch {
        return null;
    }
}