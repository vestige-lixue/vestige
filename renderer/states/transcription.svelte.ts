import { type Failure, toFailure } from "../../shared/failure";
import { type TranscriptionRequest } from "../../shared/transcription/executer";
import * as mediaImport from "./mediaImport.svelte";
import * as project from "./project.svelte";
import * as config from "./config.svelte";
import { SvelteMap } from "svelte/reactivity";

export type TranscriptionTask = {
    id: string;
    mediaId: string;
    request: TranscriptionRequest;
} & ({
    status: "queued" | "running" | "stopping";
} | {
    status: "failed";
    error: Failure;
});

let tasks = $state<TranscriptionTask[]>([]);
// Removed/stopping tasks still occupy a slot until their native invocation ends.
let activeCount = $state(0);
const completions = new SvelteMap<string, () => void>();

export function getTask(mediaId: string): TranscriptionTask | null {
    return tasks.find(task => task.mediaId === mediaId) ?? null;
}

export type TranscriptionAction = "start" | "continue" | "review-failure" | "cancel-queued" | "stopping" | "stop";

export function getAction(mediaId: string | null): TranscriptionAction {
    if (!mediaId) return "start";
    const task = getTask(mediaId);
    if (task) return task.status === "failed" ? "review-failure" : task.status === "queued" ? "cancel-queued" : task.status === "stopping" ? "stopping" : "stop";
    return project.getVestige(mediaId)?.runs.length ? "continue" : "start";
}

export function start(mediaId: string, configuration: Omit<TranscriptionRequest, "mediaPath">): Promise<void> | null {
    const previous = getTask(mediaId);
    const media = project.getMedia(mediaId);
    if (!config.isReady() || !media || !mediaImport.isReady(mediaId)
        || (previous && previous.status !== "failed")) return null;
    if (previous) discard(previous);
    const id = crypto.randomUUID();
    const completed = new Promise<void>(resolve => completions.set(id, resolve));
    tasks.push({
        id,
        mediaId,
        request: { ...configuration, mediaPath: media.path },
        status: "queued"
    });
    drain();
    return completed;
}

export function stop(mediaId: string): void {
    const task = getTask(mediaId);
    if (!task) return;
    if (task.status === "queued") {
        discard(task);
        finish(task);
        drain();
        return;
    }
    if (task.status !== "running") return;
    task.status = "stopping";
    window.api.transcription.cancel(task.id);
}

export function remove(mediaId: string): void {
    const task = getTask(mediaId);
    stop(mediaId);
    if (task) discard(task);
}

export function clear(): void {
    const previous = tasks;
    tasks = [];
    for (const task of previous) {
        if (task.status === "queued") finish(task);
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

function fail(task: TranscriptionTask, error: Failure): void {
    const index = tasks.indexOf(task);
    if (index >= 0) tasks[index] = { ...task, status: "failed", error };
}

function drain(): void {
    const concurrency = config.get()?.transcription.concurrency ?? 0;
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
    return config.subscribe(drain);
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
        else fail(task, result.error);
    }
    catch (error) {
        console.error("Unexpected transcription failure:", error);
        if (getTask(task.mediaId) === task && task.status === "running") {
            fail(task, toFailure(error));
        }
    }
    finally {
        discard(task);
        activeCount--;
        finish(task);
        drain();
    }
}

export function getTasks(): TranscriptionTask[] {
    return tasks;
}

export function hasPending(): boolean {
    return activeCount > 0 || tasks.some(task => task.status !== "failed");
}