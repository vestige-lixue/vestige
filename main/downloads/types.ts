import { type Download, type DownloadKind } from "../../shared/downloads";
import { type AbsolutePath } from "../../shared/util/path";

export type DownloadReporter = {
    append(text: string): void;
    progress(value: number | null): void;
};

export type DownloadTransfer = (
    files: { url: string; destination: AbsolutePath }[],
    directory: AbsolutePath,
    reporter: DownloadReporter,
    signal: AbortSignal
) => Promise<void>;

export type DownloadFile = { url: string; destination: string; sha256?: string; size?: number };

export type RuntimeDownload = {
    name: string;
    file: DownloadFile & { sha256: string; size: number };
    libraries: string[];
};

export type DownloadPayload = {
    files: DownloadFile[];
    notice: string;
    archive?: { filename: string; programs: string[]; exclude?: string[] };
    runtimes?: RuntimeDownload[];
};

export type DownloadSource = Pick<Download, "kind" | "id" | "name" | "estimatedBytes"> & {
    resolve(signal: AbortSignal): Promise<DownloadPayload>;
    requiredFiles?: string[];
};

export type DownloadRoots = Record<DownloadKind, AbsolutePath>;