import { type WebContents } from "electron";
import { type TranscriptionResult, executerChannel, cancelExecuterChannel } from "../../shared/transcription/executer";
import { type ExecutionPaths, transcribe } from "./execute";
import { type TaskOutputStore } from "../task/store";

export function registerTranscriptionIPCs(contents: WebContents, paths: ExecutionPaths, tasks: TaskOutputStore): void {
    const running = new Map<string, AbortController>();
    contents.ipc.handle(executerChannel, async (event, id: unknown, request: unknown): Promise<TranscriptionResult> => {
        if (event.senderFrame !== contents.mainFrame) return { success: false, error: { kind: "ipc-not-main-frame" } };
        if (typeof id !== "string" || !id || id.length > 128 || running.has(id) || tasks.get(id)?.status === "running") return { success: false, error: { kind: "transcription-invalid-id" } };
        const controller = new AbortController();
        tasks.start(id, "transcription");
        running.set(id, controller);
        try {
            const result = await transcribe(id, request, paths, controller.signal, {
                output: (_stream, text) => tasks.append(id, text),
                progress: value => tasks.progress(id, value),
                record: (event, value) => tasks.record(id, event, value)
            });
            if (result.success) tasks.record(id, "Run", JSON.stringify(result.run));
            if (!result.success) tasks.append(id, `\n${JSON.stringify(result.error)}\n`);
            tasks.finish(id, result.success ? "succeeded" : result.error.kind === "transcription-cancelled" ? "cancelled" : "failed");
            return result;
        }
        catch (error) {
            tasks.append(id, `\n${error instanceof Error ? error.message : String(error)}\n`);
            tasks.finish(id, "failed");
            throw error;
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