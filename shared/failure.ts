import { type AbsolutePath } from "./util/path";
import { type Executor } from "./transcription/executor";
import { type DownloadFailure } from "./downloads";
import { type DocumentationFailure } from "./documentation";

export type FileOperation = "read" | "write" | "inspect" | "access" | "open-directory" | "remove" | "clear-logs";

export type OperationResult = { success: true } | { success: false; error: FailureInfo };

// Application-owned failures carry identifiers and data, never display text.
// diagnostic is reserved for unmodified external exception/native output.
export type FailureInfo = (DownloadFailure | DocumentationFailure | {
    kind: "file-operation-failed";
    operation: FileOperation;
    path: string | null;
    diagnostic: string;
} | {
    kind: "external-open-failed";
    url: string;
    diagnostic: string;
} | {
    kind: "unexpected";
    diagnostic: string;
} | {
    kind: "media-not-file" | "media-size-changed" | "media-hash-changed" | "media-changed-during-read"
        | "media-missing" | "media-cancelled" | "media-source-invalidated" | "media-invalid-info"
        | "media-no-streams" | "media-no-duration" | "media-timeout" | "media-format"
        | "media-invalid-reference" | "media-invalid-check-id" | "media-invalid-concurrency" | "media-invalid-import"
        | "transcription-media-unavailable" | "transcription-cancelled" | "transcription-invalid-request"
        | "transcription-invalid-id" | "transcription-params-text" | "transcription-params-object"
        | "transcription-param-value" | "transcription-param-null"
        | "transcription-empty-result" | "transcription-truncated-output"
        | "audio-invalid-wave" | "audio-truncated-wave" | "audio-empty-wave"
        | "settings-invalid-update"
        | "path-not-absolute" | "path-drive-relative" | "project-path-not-file" | "ipc-not-main-frame"
        | "file-invalid-directory";
} | {
    kind: "transcription-unstable-output";
    start: string;
    end: string;
} | {
    kind: "native-not-found";
    executable: string;
    directory: AbsolutePath;
} | {
    kind: "native-output-limit";
    limitMiB: number;
} | {
    kind: "native-spawn-failed";
    diagnostic: string;
} | {
    kind: "native-failed";
    diagnostic: string | null;
    exitCode: number | null;
    signal: string | null;
} | {
    kind: "media-playback-failed";
    code: number | null;
    diagnostic: string | null;
} | {
    kind: "drop-unreadable";
    entry: "file" | "directory";
    diagnostic: string | null;
} | {
    kind: "file-not-local";
    name: string;
} | {
    kind: "transcription-unknown-executor";
    executor: string;
} | {
    kind: "transcription-empty-path";
    field: "backendDirectory" | "modelDirectory" | "mediaPath";
} | {
    kind: "transcription-invalid-json" | "transcription-invalid-result" | "project-invalid-json";
    diagnostic: string;
} | {
    kind: "transcription-invalid-option" | "transcription-managed-option";
    option: string;
} | {
    kind: "transcription-invalid-output";
    executor: Executor;
    field: "transcription" | "text" | "segment.text";
} | {
    kind: "project-invalid-structure";
    path: string;
    expected: string;
} | {
    kind: "project-invalid-number";
    path: string;
    integer: boolean;
} | {
    kind: "project-version";
    version: string;
} | {
    kind: "project-invalid-uuid" | "project-duplicate-media" | "project-invalid-path" | "project-reversed-range";
    path: string;
});

// Only used within a process. IPC replies transport failure as a plain object.
export class VestigeErrors extends Error {
    readonly failure: FailureInfo;

    constructor(failure: FailureInfo, options?: ErrorOptions) {
        super(failure.kind, options);
        this.failure = failure;
    }
}

export function toFailureInfo(error: unknown): FailureInfo {
    if (isExpectedFailure(error)) return error.failure;
    return { kind: "unexpected", diagnostic: error instanceof Error ? error.message : String(error) };
}

export function isExpectedFailure(error: unknown): error is VestigeErrors {
    return error instanceof VestigeErrors;
}