import { type FailureInfo } from "../failure";
import { type AbsolutePath } from "../util/path";

export type ExportFormat = "txt" | "srt";
export type TranscriptExportRequest = { mediaId: string; format: ExportFormat; content: string; defaultPath: AbsolutePath };
export type TranscriptExportResult = { success: true; path: string } | { success: false; error: FailureInfo } | null;

export function transcriptExportPath(path: AbsolutePath, format: ExportFormat): AbsolutePath {
    const separator = path.lastIndexOf(path.startsWith("/") ? "/" : "\\");
    const extension = path.lastIndexOf(".");
    return (extension > separator + 1 ? path.slice(0, extension) : path) + "." + format as AbsolutePath;
}