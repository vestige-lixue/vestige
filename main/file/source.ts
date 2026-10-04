import { net, protocol } from "electron";
import { randomUUID } from "node:crypto";
import { open, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { type MediaURLResult } from "../../shared/media/check";
import { errorMessage, filePath, isSystemError } from "../util/file";

const scheme = "vestige-media";
type MediaSource = { path: string; controller: AbortController; pending: Set<Promise<unknown>> };
const sources = new Map<string, MediaSource>();

export function registerMediaScheme(): void {
    protocol.registerSchemesAsPrivileged([{ scheme, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);
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
        const response = await net.fetch(pathToFileURL(source.path).href, { method: request.method, headers, signal });
        if (signal.aborted) {
            await response.body?.cancel();
            signal.throwIfAborted();
        }
        // Chromium's file response honors Range but omits the HTTP range and length headers.
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Accept-Ranges", "bytes");
        responseHeaders.set("Content-Length", String(end - start + 1));
        if (range) responseHeaders.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
        if (request.method === "HEAD") await response.body?.cancel();
        const body = request.method === "HEAD" || !response.body ? null : trackBody(source, response.body, signal);
        return new Response(body, { status: range ? 206 : 200, headers: responseHeaders });
    }
    catch {
        return new Response(null, { status: 404 });
    }
}

function trackBody(source: MediaSource, body: ReadableStream<Uint8Array>, signal: AbortSignal): ReadableStream<Uint8Array> {
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
        source.pending.delete(pending);
        complete();
    };
    const cancel = (reason: unknown): Promise<void> => {
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
    const path = filePath(input);
    try {
        const file = await open(path, "r");
        try {
            if (!(await file.stat()).isFile()) return { status: "unreadable", error: "该路径不是普通文件。" };
        }
        finally {
            await file.close();
        }
        const id = randomUUID();
        sources.set(id, { path, controller: new AbortController(), pending: new Set() });
        return { status: "ready", id, url: `${scheme}://${id}/` };
    }
    catch (error) {
        if (!isSystemError(error)) throw error;
        const code = error.code;
        return code === "ENOENT" || code === "ENOTDIR"
            ? { status: "missing", error: "找不到此路径下的媒体文件，文件可能已移动或重命名。" }
            : { status: "unreadable", error: errorMessage(error) };
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