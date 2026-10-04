import { type TranscriptionRequest } from "../../shared/transcription/executer";
import * as mediaImport from "./mediaImport.svelte";
import * as project from "./project.svelte";

export type TranscriptionTask = {
    id: string;
    mediaId: string;
    request: TranscriptionRequest;
} & ({
    status: "running" | "stopping";
} | {
    status: "failed";
    error: string;
});

let tasks = $state<TranscriptionTask[]>([]);

export function getTask(mediaId: string): TranscriptionTask | null {
    return tasks.find(task => task.mediaId === mediaId) ?? null;
}

export function getLabel(mediaId: string | null): string {
    if (!mediaId) return "开始转写";
    const task = getTask(mediaId);
    if (task) return task.status === "failed" ? "失败详情" : "停止转写";
    return project.getVestige(mediaId)?.runs.length ? "继续转写" : "开始转写";
}

export function start(mediaId: string, configuration: Omit<TranscriptionRequest, "mediaPath">): Promise<void> | null {
    const previous = getTask(mediaId);
    const media = project.getMedia(mediaId);
    if (!media || !mediaImport.isReady(mediaId)
        || (previous && previous.status !== "failed")) return null;
    if (previous) discard(previous);
    tasks.push({
        id: crypto.randomUUID(),
        mediaId,
        request: { ...configuration, mediaPath: media.path },
        status: "running"
    });
    return runTask(tasks[tasks.length - 1]);
}

export function stop(mediaId: string): void {
    const task = getTask(mediaId);
    if (!task || task.status !== "running") return;
    task.status = "stopping";
    window.api.transcription.cancel(task.id);
}

export function remove(mediaId: string): void {
    const task = getTask(mediaId);
    stop(mediaId);
    if (task) discard(task);
}

export function clear(): void {
    for (const task of tasks) stop(task.mediaId);
    tasks = [];
}

function discard(task: TranscriptionTask): void {
    const index = tasks.indexOf(task);
    if (index >= 0) tasks.splice(index, 1);
}

async function runTask(task: TranscriptionTask): Promise<void> {
    const media = project.getMedia(task.mediaId)!;
    const mediaPath = task.request.mediaPath;
    const hash = media.hash;
    try {
        await Promise.resolve();
        if (getTask(task.mediaId) !== task || task.status !== "running" || !project.getMedia(task.mediaId)) return;
        const result = await window.api.transcription.transcribe(task.id, $state.snapshot(task.request));
        const current = project.getMedia(task.mediaId);
        if (getTask(task.mediaId) !== task || task.status !== "running"
            || !current || current.path !== mediaPath || current.hash !== hash) return;
        if (result.success) project.appendRun(task.mediaId, result.run);
        else tasks[tasks.indexOf(task)] = { ...task, status: "failed", error: result.error };
    }
    catch (error) {
        console.error("Unexpected transcription failure:", error);
        throw error;
    }
    finally {
        discard(task);
    }
}

export function getTasks(): TranscriptionTask[] {
    return tasks;
}

export function hasPending(): boolean {
    return tasks.some(task => task.status !== "failed");
}