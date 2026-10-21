import { VestigeErrors, toFailureInfo } from "../../shared/failure";
import { net, protocol } from "electron";
import { randomUUID } from "node:crypto";
import { open, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { type MediaURLResult } from "../../shared/media/check";
import { filePath, isSystemError } from "../util/file";

const scheme = "vestige-media";
type MediaSource = { path: string; controller: AbortController; pending: Set<Promise<unknown>> };
const sources = new Map<string, MediaSource>();

export function registerMediaScheme(): void {
    protocol.registerSchemesAsPrivileged([{ scheme, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }]);
}

export function registerMediaProtocol(): void {
    protocol.handle(scheme, async request => {
        const source = sources.get(new URL(request.url).hostname);
        if (!source) return new Response(null, { status: 404 });
        if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
        const signal = AbortSignal.any([request.signal, source.controller.signal]);
        const pending = respond(source, request, signal);
        source.pending.add(pending);
        try {
            return await pending;
        }
        finally {
            source.pending.delete(pending);
        }
    });
}

async function respond(source: MediaSource, request: Request, signal: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    try {
        const info = await stat(source.path);
        signal.throwIfAborted();
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
        const response = await net.fetch(pathToFileURL(source.path).href, {
            method: request.method,
            headers,
            signal: AbortSignal.any([signal, controller.signal])
        });
        if (signal.aborted) {
            await response.body?.cancel();
            signal.throwIfAborted();
        }
        // Chromium's file response honors Range but omits the HTTP range and length headers.
        const responseHeaders = new Headers(response.headers);
        // URLs are opaque, temporary handles; anonymous CORS lets Web Audio read
        // the same stream from both the development origin and packaged file://.
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Accept-Ranges", "bytes");
        responseHeaders.set("Content-Length", String(end - start + 1));
        if (range) responseHeaders.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
        if (request.method === "HEAD" || !response.body) {
            controller.abort();
            await response.body?.cancel();
        }
        const body = request.method === "HEAD" || !response.body ? null : trackBody(source, response.body, signal, controller);
        return new Response(body, { status: range ? 206 : 200, headers: responseHeaders });
    }
    catch {
        controller.abort();
        return new Response(null, { status: 404 });
    }
}

function trackBody(source: MediaSource, body: ReadableStream<Uint8Array>, signal: AbortSignal, requestController: AbortController): ReadableStream<Uint8Array> {
    const reader = body.getReader();
    let complete: () => void;
    const pending = new Promise<void>(resolve => {
        complete = resolve;
    });
    source.pending.add(pending);
    let abort: () => void;
    let cancelling: Promise<void> | null = null;
    const finish = (): void => {
        signal.removeEventListener("abort", abort);
        requestController.abort();
        reader.releaseLock();
        source.pending.delete(pending);
        complete();
    };
    const cancel = (reason: unknown): Promise<void> => {
        // Canceling the response reader alone leaves Electron's native file loader alive.
        requestController.abort(reason);
        cancelling ??= reader.cancel(reason).catch(() => {}).finally(finish);
        return cancelling;
    };
    return new ReadableStream({
        start(controller) {
            abort = () => {
                controller.error(signal.reason);
                void cancel(signal.reason);
            };
            signal.addEventListener("abort", abort, { once: true });
            if (signal.aborted) abort();
        },
        async pull(controller) {
            try {
                const result = await reader.read();
                if (cancelling) return;
                if (result.done) {
                    controller.close();
                    finish();
                }
                else controller.enqueue(result.value);
            }
            catch (error) {
                if (cancelling) return;
                controller.error(error);
                finish();
            }
        },
        cancel
    });
}

function rangeError(size: number): Response {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
}

export async function getMediaURL(input: unknown): Promise<MediaURLResult> {
    try {
        const path = filePath(input);
        const file = await open(path, "r");
        try {
            if (!(await file.stat()).isFile()) return { status: "unreadable", error: { kind: "media-not-file" } };
        }
        finally {
            await file.close();
        }
        const id = randomUUID();
        sources.set(id, { path, controller: new AbortController(), pending: new Set() });
        return { status: "ready", id, url: `${scheme}://${id}/` };
    }
    catch (error) {
        if (error instanceof VestigeErrors) return { status: "unreadable", error: error.failure };
        if (!isSystemError(error)) throw error;
        const code = error.code;
        return code === "ENOENT" || code === "ENOTDIR"
            ? { status: "missing", error: { kind: "media-missing" } }
            : { status: "unreadable", error: toFailureInfo(error) };
    }
}

export async function releaseMediaURL(id: unknown): Promise<void> {
    if (typeof id !== "string") return;
    const source = sources.get(id);
    if (!source) return;
    sources.delete(id);
    source.controller.abort();
    await Promise.allSettled(source.pending);
}

export async function releaseMediaURLs(): Promise<void> {
    await Promise.all([...sources.keys()].map(releaseMediaURL));
}