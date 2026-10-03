import { net, protocol, type Session, type WebContents } from "electron";
import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { type MediaSourceHandle } from "../../shared/media/check";
import { filePath } from "../util/file";

const scheme = "vestige-media";
const sources = new Map<string, { path: string; owner: WebContents }>();
const registered = new WeakSet<Session>();

export function registerMediaScheme(): void {
    protocol.registerSchemesAsPrivileged([{ scheme, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);
}

export function registerMediaProtocol(session: Session): void {
    if (registered.has(session)) return;
    registered.add(session);
    session.protocol.handle(scheme, async request => {
        const source = sources.get(new URL(request.url).hostname);
        if (!source || source.owner.isDestroyed()) return new Response(null, { status: 404 });
        if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
        try {
            const info = await stat(source.path);
            if (!info.isFile()) return new Response(null, { status: 404 });
            const range = request.method === "GET" ? request.headers.get("range") : null;
            let start = 0;
            let end = info.size - 1;
            if (range) {
                const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
                if (!parts || (!parts[1] && !parts[2])) return rangeError(info.size);
                start = parts[1] ? Number(parts[1]) : Math.max(0, info.size - Number(parts[2]));
                end = parts[1] && parts[2] ? Math.min(Number(parts[2]), end) : end;
                if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) return rangeError(info.size);
            }
            const headers = new Headers();
            if (range) headers.set("Range", `bytes=${start}-${end}`);
            const response = await net.fetch(pathToFileURL(source.path).href, { method: request.method, headers, signal: request.signal });
            // Chromium's file response honors Range but omits the HTTP range and length headers.
            const responseHeaders = new Headers(response.headers);
            responseHeaders.set("Accept-Ranges", "bytes");
            responseHeaders.set("Content-Length", String(end - start + 1));
            if (range) responseHeaders.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
            if (request.method === "HEAD") await response.body?.cancel();
            return new Response(request.method === "HEAD" ? null : response.body, { status: range ? 206 : 200, headers: responseHeaders });
        }
        catch {
            return new Response(null, { status: 404 });
        }
    });
}

function rangeError(size: number): Response {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
}

export function openMediaSource(owner: WebContents, path: unknown): MediaSourceHandle {
    const id = randomUUID();
    sources.set(id, { path: filePath(path), owner });
    return { id, url: `${scheme}://${id}/` };
}

export function closeMediaSource(owner: WebContents, id: unknown): void {
    if (typeof id === "string" && sources.get(id)?.owner === owner) sources.delete(id);
}

export function closeMediaSources(owner: WebContents): void {
    for (const [id, source] of sources) if (source.owner === owner) sources.delete(id);
}