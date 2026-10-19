import { type FailureInfo, toFailureInfo } from "../../shared/failure";
import { type TranscriptionRequest } from "../../shared/transcription/executer";
import { type Config } from "../../shared/transcription/Config";
import * as mediaImport from "./mediaImport.svelte";
import * as project from "./project.svelte";
import * as settings from "./settings.svelte";
import { SvelteMap } from "svelte/reactivity";

export type TranscriptionTask = {
    id: string;
    mediaId: string;
    mediaName: string;
    request: TranscriptionRequest;
} & ({
    status: "queued" | "running" | "stopping" | "succeeded" | "cancelled";
} | {
    status: "failed";
    error: FailureInfo;
});

const tasks = $state<TranscriptionTask[]>([]);
// Stopping tasks still occupy a slot until their native invocation ends.
let activeCount = $state(0);
const completions = new SvelteMap<string, () => void>();

export function getTask(mediaId: string): TranscriptionTask | null {
    return tasks.findLast(task => task.mediaId === mediaId) ?? null;
}

export function getTaskById(taskId: string): TranscriptionTask | null {
    return tasks.find(task => task.id === taskId) ?? null;
}

export function isPending(task: TranscriptionTask | null): boolean {
    return task?.status === "queued" || task?.status === "running" || task?.status === "stopping";
}

export type TranscriptionAction = "start" | "review-failure" | "cancel-queued" | "stopping" | "stop";

export function getAction(mediaId: string | null): TranscriptionAction {
    if (!mediaId) return "start";
    const task = getTask(mediaId);
    if (task?.status === "failed") return "review-failure";
    if (task?.status === "queued") return "cancel-queued";
    if (task?.status === "stopping") return "stopping";
    if (task?.status === "running") return "stop";
    return "start";
}

export function start(mediaId: string, config: Config): Promise<void> | null {
    const previous = getTask(mediaId);
    const media = project.getMedia(mediaId);
    if (!settings.isReady() || !media || !mediaImport.isReady(mediaId)
        || isPending(previous)) return null;
    const id = crypto.randomUUID();
    const completed = new Promise<void>(resolve => completions.set(id, resolve));
    tasks.push({
        id,
        mediaId,
        mediaName: media.name,
        request: { ...config, params: JSON.stringify(config.params), mediaPath: media.path, mediaDuration: media.duration },
        status: "queued"
    });
    drain();
    return completed;
}

export function stop(mediaId: string): void {
    const task = getTask(mediaId);
    if (task) stopTask(task.id);
}

export function stopTask(taskId: string): void {
    const task = getTaskById(taskId);
    if (!task) return;
    if (task.status === "queued") {
        task.status = "cancelled";
        finish(task);
        drain();
        return;
    }
    if (task.status !== "running") return;
    task.status = "stopping";
    window.api.transcription.cancel(task.id);
}

export function remove(taskId: string): void {
    const task = getTaskById(taskId);
    if (!task || task.status === "running" || task.status === "stopping") return;
    if (task.status === "queued") {
        task.status = "cancelled";
        finish(task);
    }
    tasks.splice(tasks.indexOf(task), 1);
    drain();
}

export function stopAll(): void {
    for (const task of tasks) {
        if (task.status === "queued") {
            task.status = "cancelled";
            finish(task);
        }
        else if (task.status === "running") {
            task.status = "stopping";
            window.api.transcription.cancel(task.id);
        }
    }
}

function finish(task: TranscriptionTask): void {
    completions.get(task.id)?.();
    completions.delete(task.id);
}

function fail(task: TranscriptionTask, error: FailureInfo): void {
    const index = tasks.indexOf(task);
    if (index >= 0) tasks[index] = { ...task, status: "failed", error };
}

function drain(): void {
    const concurrency = settings.get()?.transcription.concurrency ?? 0;
    while (activeCount < concurrency) {
        const task = tasks.find(task => task.status === "queued");
        if (!task) break;
        const media = project.getMedia(task.mediaId);
        if (!media || media.path !== task.request.mediaPath || !mediaImport.isReady(task.mediaId)) {
            fail(task, { kind: "transcription-media-unavailable" });
            finish(task);
            continue;
        }
        task.status = "running";
        activeCount++;
        void runTask(task);
    }
}

export function startLifecycle(): () => void {
    return settings.subscribe(drain);
}

async function runTask(task: TranscriptionTask): Promise<void> {
    const media = project.getMedia(task.mediaId)!;
    const mediaPath = task.request.mediaPath;
    const { size, mtimeMs } = media;
    try {
        await Promise.resolve();
        if (getTaskById(task.id) !== task || task.status !== "running" || !project.getMedia(task.mediaId)) return;
        const result = await window.api.transcription.transcribe(task.id, $state.snapshot(task.request));
        const current = project.getMedia(task.mediaId);
        if (getTaskById(task.id) !== task || task.status !== "running"
            || !current || current.path !== mediaPath || current.size !== size || current.mtimeMs !== mtimeMs) return;
        if (result.success) {
            project.appendRun(task.mediaId, result.run);
            task.status = "succeeded";
        }
        else fail(task, result.error);
    }
    catch (error) {
        console.error("Unexpected transcription failure:", error);
        if (getTaskById(task.id) === task && task.status === "running") {
            fail(task, toFailureInfo(error));
        }
    }
    finally {
        if (getTaskById(task.id) === task && (task.status === "running" || task.status === "stopping")) task.status = "cancelled";
        activeCount--;
        finish(task);
        drain();
    }
}

export function getTasks(): TranscriptionTask[] {
    return [...tasks].reverse();
}

export function hasPending(): boolean {
    return activeCount > 0 || tasks.some(isPending);
}