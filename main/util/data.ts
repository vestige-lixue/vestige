import { VestigeErrors } from "../../shared/failure";

export function decodeUTF8(bytes: Uint8Array): string {
    try {
        // TextDecoder consumes the optional UTF-8 BOM and rejects invalid bytes.
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch (cause) {
        throw new VestigeErrors({ kind: "invalid-encoding" }, { cause });
    }
}

export function parseJSON(text: string): unknown {
    try {
        return JSON.parse(text);
    }
    catch (cause) {
        if (!(cause instanceof SyntaxError)) throw cause;
        throw new VestigeErrors({ kind: "invalid-json", diagnostic: cause.message }, { cause });
    }
}

// Check the format version before the structure, so files from newer versions report their version.
export function checkVersion(root: "project" | "settings" | "vocabulary", value: unknown, current: string | number): void {
    if (value === null || typeof value !== "object" || !("version" in value)) return;
    const { version } = value;
    if (typeof version === typeof current && version !== current) {
        throw new VestigeErrors({ kind: "unsupported-version", file: root, version: String(version) });
    }
}

export function structureError(root: "project" | "settings" | "vocabulary", issue: { path?: string; expected: string }): VestigeErrors {
    const path = issue.path?.replace(/^\$input/u, root) ?? root;
    return new VestigeErrors(issue.expected === "undefined" ? { kind: "unknown-field", path }
        : { kind: "invalid-structure", path, expected: issue.expected }, { cause: issue });
}