import { type WebContents } from "electron";
import { type TranscriptionResult, executerChannel, cancelExecuterChannel } from "../../shared/transcription/executer";
import { type ExecutionPaths, transcribe } from "./execute";

export function registerTranscriptionIPCs(contents: WebContents, paths: ExecutionPaths): void {
    const running = new Map<string, AbortController>();
    contents.ipc.handle(executerChannel, async (event, id: unknown, request: unknown): Promise<TranscriptionResult> => {
        if (event.senderFrame !== contents.mainFrame) return { ok: false, error: "Transcription is only available to the main frame." };
        if (typeof id !== "string" || !id || id.length > 128 || running.has(id)) return { ok: false, error: "A unique transcription task ID is required." };
        const controller = new AbortController();
        running.set(id, controller);
        try {
            return { ok: true, run: await transcribe(request, paths, controller.signal) };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        finally {
            running.delete(id);
        }
    });
    contents.ipc.on(cancelExecuterChannel, (event, id: unknown) => {
        if (event.senderFrame === contents.mainFrame && typeof id === "string") running.get(id)?.abort();
    });
    const cancelAll = (): void => {
        for (const controller of running.values()) controller.abort();
    };
    contents.once("destroyed", cancelAll);
    contents.on("render-process-gone", cancelAll);
    contents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) cancelAll();
    });
}