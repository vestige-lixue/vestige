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

export type DownloadPayload = {
    files: { url: string; destination: string; sha256?: string; size?: number }[];
    notice: string;
    archive?: { filename: string; program: string };
};

export type DownloadSource = Pick<Download, "kind" | "id" | "name" | "estimatedBytes"> & {
    resolve(signal: AbortSignal): Promise<DownloadPayload>;
};

export type DownloadRoots = Record<DownloadKind, AbsolutePath>;