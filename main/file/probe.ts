import { toFailure } from "../../shared/failure";
import { dirname } from "node:path";
import { type Media } from "../../shared/Media";
import { type MediaCheckResult } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import { filePath } from "../util/file";
import { findExecutable, NativeProcessError, runProcess } from "../util/process";

type MetadataResult = ({
    status: "ready";
    metadata: Pick<Media, "kind" | "duration">;
} | Exclude<MediaCheckResult, { status: "ready" }>);

function object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function duration(value: unknown): number | null {
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
    const result = Number(value);
    return Number.isFinite(result) && result >= 0 ? result : null;
}

export async function probeMedia(path: AbsolutePath, runtimeDirectory: AbsolutePath, signal: AbortSignal): Promise<MetadataResult> {
    const timeout = AbortSignal.timeout(15_000);
    const operation = AbortSignal.any([signal, timeout]);
    try {
        operation.throwIfAborted();
        const ffprobe = await findExecutable(runtimeDirectory, "ffmpeg", "ffprobe");
        const { stdout } = await runProcess(ffprobe, [
            "-v", "error", "-show_entries", "format=duration:stream=codec_type,duration:stream_disposition=attached_pic",
            "-of", "json", "-i", path
        ], filePath(dirname(path)), operation);
        operation.throwIfAborted();
        let value: unknown;
        try {
            value = JSON.parse(stdout);
        }
        catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
            return { status: "unreadable", error: { kind: "media-invalid-info" } };
        }
        const info = object(value);
        const streams = Array.isArray(info?.streams) ? info.streams.map(object).filter(stream => stream !== null) : [];
        const video = streams.some(stream => stream.codec_type === "video" && object(stream.disposition)?.attached_pic !== 1);
        if (!video && !streams.some(stream => stream.codec_type === "audio")) {
            return { status: "unreadable", error: { kind: "media-no-streams" } };
        }
        const streamDurations = streams.map(stream => duration(stream.duration)).filter(value => value !== null);
        const seconds = duration(object(info?.format)?.duration) ?? (streamDurations.length ? Math.max(...streamDurations) : null);
        if (seconds === null) return { status: "unreadable", error: { kind: "media-no-duration" } };
        return { status: "ready", metadata: { kind: video ? "video" : "audio", duration: seconds } };
    }
    catch (error) {
        if (signal.aborted) return { status: "cancelled", error: { kind: "media-cancelled" } };
        if (timeout.aborted) return { status: "unreadable", error: { kind: "media-timeout" } };
        if (error instanceof NativeProcessError) return { status: "unreadable", error: toFailure(error) };
        throw error;
    }
}