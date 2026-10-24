import { type FailureInfo } from "./failure";

export type DownloadKind = "backend" | "model";

export type DownloadFailure = ({
    kind: "download-invalid-request" | "download-closing";
} | {
    kind: "download-http";
    stage: "metadata" | "rpc";
    reason: "http" | "request" | "metadata" | "asset";
    resource: string;
    status: number | null;
    diagnostic?: string;
} | {
    kind: "download-transfer";
    reason: "rpc" | "stopped" | "process-exited" | "shutdown-timeout" | "port";
    code: string | null;
    file?: string;
    diagnostic?: string;
} | {
    kind: "download-proxy";
    reason: "timeout" | "unsupported" | "resolution";
    diagnostic?: string;
} | {
    kind: "download-integrity";
    reason: "checksum" | "size" | "empty" | "html" | "runtime-manifest" | "runtime-file" | "runtime-license";
    file: string;
    expected?: string | number;
    actual?: string | number;
    diagnostic?: string;
} | {
    kind: "download-archive";
    reason: "unsafe-entry" | "unsupported-entry" | "missing-file" | "unpack";
    path: string;
    diagnostic?: string;
    exitCode?: number | null;
    signal?: string | null;
} | {
    kind: "download-conflict";
    scope: "destination" | "backend" | "runtime";
    reason: "exists" | "mismatch" | "filename";
    path: string;
    diagnostic?: string;
} | {
    kind: "download-cleanup";
    directory: string;
    installed: boolean;
    diagnostic: string;
});

export type Download = {
    kind: DownloadKind;
    id: string;
    name: string;
    estimatedBytes: number;
    taskId: string | null;
    installed: boolean;
};

export type DownloadListResult = { success: true; downloads: Download[] } | { success: false; error: FailureInfo };
export type DownloadStartResult = { success: true; taskId: string } | { success: false; error: FailureInfo };

export const downloadChannels = {
    list: "downloads:list",
    start: "downloads:start",
    cancel: "downloads:cancel",
    openDirectory: "downloads:open-directory"
} as const;