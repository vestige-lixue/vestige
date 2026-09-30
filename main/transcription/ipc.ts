import { type WebContents } from "electron";
import { type TranscriptionResult, executerChannel } from "../../shared/transcription/executer";
import { type ExecutionPaths, transcribe } from "./execute";

export function registerTranscriptionIPCs(contents: WebContents, paths: ExecutionPaths): void {
    const running = new Set<AbortController>();
    contents.ipc.handle(executerChannel, async (event, request: unknown): Promise<TranscriptionResult> => {
        if (event.senderFrame !== contents.mainFrame) return { ok: false, error: "Transcription is only available to the main frame." };
        const controller = new AbortController();
        running.add(controller);
        try {
            return { ok: true, run: await transcribe(request, paths, controller.signal) };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        finally {
            running.delete(controller);
        }
    });
    contents.once("destroyed", () => {
        for (const controller of running) controller.abort();
    });
}