import { type BrowserWindow } from "electron";
import { exportChannels } from "../../shared/ipc";
import { type TranscriptExportResult } from "../../shared/export/TranscriptExport";
import { isExpectedFailure, toFailureInfo } from "../../shared/failure";
import { handle } from "../util/ipc";
import { isSystemError, parseAbsolutePath } from "../util/file";
import { fileOperationFailure, writeFileAtomic } from "../util/fs";
import { selectTranscriptExportPath } from "../ui/fileDialogs";

export function registerExportIPCs(window: BrowserWindow): void {
    handle(window.webContents, exportChannels.transcript, async (request: unknown): Promise<TranscriptExportResult> => {
        if (!request || typeof request !== "object" || !("mediaId" in request) || typeof request.mediaId !== "string" || !request.mediaId
            || !("format" in request) || request.format !== "txt" && request.format !== "srt"
            || !("content" in request) || typeof request.content !== "string" || !("defaultPath" in request)) {
            return { success: false, error: { kind: "export-invalid-request" } };
        }
        let path: string | null = null;
        try {
            const defaultPath = parseAbsolutePath(request.defaultPath);
            path = await selectTranscriptExportPath(window, defaultPath, request.format);
            if (path === null) return null;
            const content = request.format === "srt" ? "\uFEFF" + request.content.replace(/\r\n|\r|\n/gu, "\r\n") : request.content;
            await writeFileAtomic(path, content, { sync: true, mode: undefined });
            return { success: true, path };
        }
        catch (error) {
            if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "write", path) };
            if (isExpectedFailure(error)) return { success: false, error: toFailureInfo(error) };
            throw error;
        }
    });
}