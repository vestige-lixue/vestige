import { type Media } from "../../shared/Media";
import { type MediaIssueStatus } from "../../shared/media/check";
import { getFileName, type AbsolutePath } from "../../shared/util/path";

export type MediaImportStage = "path" | "metadata" | "hash";
export type MediaInput = File | AbsolutePath;
export type MediaLoadResult = ({
    status: "available";
    media: Media;
} | {
    status: MediaIssueStatus;
    error: string;
    path: AbsolutePath | null;
});

async function probeMedia(path: AbsolutePath, signal: AbortSignal): Promise<Pick<Media, "kind" | "duration">> {
    const source = await window.api.file.openMediaSource(path);
    const element = document.createElement("video");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    try {
        signal.throwIfAborted();
        return await new Promise((resolve, reject) => {
            abort = (): void => reject(signal.reason);
            signal.addEventListener("abort", abort, { once: true });
            element.onloadedmetadata = () => {
                if (!Number.isFinite(element.duration) || element.duration < 0) reject(new Error("无法确定媒体时长。"));
                else resolve({ kind: element.videoWidth > 0 ? "video" : "audio", duration: element.duration });
            };
            element.onerror = () => reject(new Error("无法读取媒体信息，文件可能已变化或格式不受支持。"));
            timeout = setTimeout(() => reject(new Error("读取媒体信息超时，请重试。")), 15_000);
            element.preload = "metadata";
            element.src = source.url;
        });
    }
    finally {
        clearTimeout(timeout);
        if (abort) signal.removeEventListener("abort", abort);
        element.onloadedmetadata = null;
        element.onerror = null;
        element.removeAttribute("src");
        element.load();
        window.api.file.closeMediaSource(source.id);
    }
}

// Every entry point resolves to a path, then uses the same reader and metadata probe.
export async function getMediaInfo(
    input: MediaInput,
    expected: Media | null,
    onStage: (stage: MediaImportStage) => void,
    signal: AbortSignal
): Promise<MediaLoadResult> {
    let path: AbsolutePath | null = null;
    try {
        signal.throwIfAborted();
        onStage("path");
        path = typeof input === "string" ? input : await window.api.file.getPathForFile(input);
        signal.throwIfAborted();
        const id = crypto.randomUUID();
        const cancel = (): void => window.api.file.cancelMediaRead(id);
        signal.addEventListener("abort", cancel, { once: true });
        try {
            onStage("hash");
            const result = await window.api.file.readMedia(id, path, expected ? { size: expected.size, hash: expected.hash } : null);
            signal.throwIfAborted();
            if (result.status !== "available") return { ...result, path };
            onStage("metadata");
            const metadata = await probeMedia(result.path, signal);
            signal.throwIfAborted();
            return { status: "available", media: {
                path: result.path, name: expected?.name ?? getFileName(result.path),
                size: result.size, hash: result.hash, ...metadata
            } };
        }
        finally {
            signal.removeEventListener("abort", cancel);
        }
    }
    catch (error) {
        if (signal.aborted) throw error;
        return { status: "unreadable", path, error: error instanceof Error ? error.message : String(error) };
    }
}