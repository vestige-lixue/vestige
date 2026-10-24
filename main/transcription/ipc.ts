import { type WebContents } from "electron";
import { type TranscriptionResult, executorChannel, cancelExecutorChannel } from "../../shared/transcription/executor";
import { type ExecutionPaths, transcribe } from "./execute";
import { type TaskOutputStore } from "../task/store";
import { handle, listen } from "../util/ipc";
import { toFailureInfo } from "../../shared/failure";
import { isTaskPending } from "../../shared/task";
import { type TaskAdmission } from "../task/admission";

export function registerTranscriptionIPCs(contents: WebContents, paths: ExecutionPaths, tasks: TaskOutputStore, admission: TaskAdmission): () => Promise<void> {
    const active = new Map<string, { controller: AbortController; completion: Promise<TranscriptionResult> }>();
    let closing = false;
    const runTask = async (id: string, request: unknown, controller: AbortController): Promise<TranscriptionResult> => {
        try {
            return await admission.run(controller.signal, async (): Promise<TranscriptionResult> => {
                try {
                    tasks.start(id);
                    const result = await transcribe(id, request, paths, controller.signal, {
                        output: (_stream, text) => tasks.append(id, text),
                        progress: value => tasks.progress(id, value),
                        record: (event, value) => tasks.record(id, event, value)
                    });
                    if (result.success) tasks.record(id, "Run", JSON.stringify(result.run));
                    if (!result.success) tasks.append(id, `\n${JSON.stringify(result.error)}\n`);
                    tasks.finish(id, result.success ? "succeeded" : result.error.kind === "transcription-cancelled" ? "cancelled" : "failed", result.success ? null : result.error);
                    return result;
                }
                catch (error) {
                    if (controller.signal.aborted && error === controller.signal.reason) {
                        tasks.finish(id, "cancelled");
                        return { success: false, error: { kind: "transcription-cancelled" } };
                    }
                    tasks.append(id, `\n${error instanceof Error ? error.message : String(error)}\n`);
                    tasks.finish(id, "failed", toFailureInfo(error));
                    throw error;
                }
            });
        }
        catch (error) {
            // Waiting for capacity is cancellable without starting a native process.
            if (controller.signal.aborted && error === controller.signal.reason) {
                tasks.finish(id, "cancelled");
                return { success: false, error: { kind: "transcription-cancelled" } };
            }
            throw error;
        }
        finally {
            active.delete(id);
        }
    };
    handle(contents, executorChannel, (id: unknown, request: unknown): Promise<TranscriptionResult> | TranscriptionResult => {
        if (closing) return { success: false, error: { kind: "transcription-cancelled" } };
        const previous = typeof id === "string" ? tasks.get(id) : null;
        if (typeof id !== "string" || !id || id.length > 128 || active.has(id) || previous && isTaskPending(previous.status)) return { success: false, error: { kind: "transcription-invalid-id" } };
        const controller = new AbortController();
        tasks.enqueue(id, "transcription");
        const completion = runTask(id, request, controller);
        active.set(id, { controller, completion });
        return completion;
    });
    listen(contents, cancelExecutorChannel, (id: unknown) => {
        if (typeof id === "string") active.get(id)?.controller.abort();
    });
    const cancelAll = (): void => {
        for (const task of active.values()) task.controller.abort();
    };
    contents.once("destroyed", () => {
        closing = true;
        cancelAll();
    });
    contents.on("render-process-gone", cancelAll);
    contents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) cancelAll();
    });
    return async () => {
        closing = true;
        cancelAll();
        await Promise.allSettled([...active.values()].map(task => task.completion));
    };
}