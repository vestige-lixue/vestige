import { type FailureInfo, toFailureInfo } from "../../shared/failure";
import { type Config } from "../../shared/transcription/Config";
import * as mediaImport from "./mediaImport.svelte";
import * as project from "./project.svelte";
import * as settings from "./settings.svelte";
import { SvelteMap } from "svelte/reactivity";
import * as transcription from "./transcription.svelte";
import * as settingsAPI from "./settings";
import * as projectAPI from "./project";

const completions = new SvelteMap<string, () => void>();

export function start(mediaId: string, config: Config): Promise<void> | null {
    const previous = transcription.getTask(mediaId);
    const media = project.getMedia(mediaId);
    if (!settings.isReady() || !media || !mediaImport.isReady(mediaId)
        || transcription.isPending(previous)) return null;
    const id = crypto.randomUUID();
    const completed = new Promise<void>(resolve => completions.set(id, resolve));
    transcription.tasks.push({
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
    const task = transcription.getTask(mediaId);
    if (task) stopTask(task.id);
}

export function stopTask(taskId: string): void {
    const task = transcription.getTaskById(taskId);
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
    const task = transcription.getTaskById(taskId);
    if (!task || task.status === "running" || task.status === "stopping") return;
    if (task.status === "queued") {
        task.status = "cancelled";
        finish(task);
    }
    transcription.tasks.splice(transcription.tasks.indexOf(task), 1);
    drain();
}

export function stopAll(): void {
    for (const task of transcription.tasks) {
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

function finish(task: transcription.TranscriptionTask): void {
    completions.get(task.id)?.();
    completions.delete(task.id);
}

function fail(task: transcription.TranscriptionTask, error: FailureInfo): void {
    const index = transcription.tasks.indexOf(task);
    if (index >= 0) transcription.tasks[index] = { ...task, status: "failed", error };
}

function drain(): void {
    const concurrency = settings.get()?.transcription.concurrency ?? 0;
    while (transcription.state.activeCount < concurrency) {
        const task = transcription.tasks.find(task => task.status === "queued");
        if (!task) break;
        const media = project.getMedia(task.mediaId);
        if (!media || media.path !== task.request.mediaPath || !mediaImport.isReady(task.mediaId)) {
            fail(task, { kind: "transcription-media-unavailable" });
            finish(task);
            continue;
        }
        task.status = "running";
        transcription.state.activeCount++;
        void runTask(task);
    }
}

export function startLifecycle(): () => void {
    return settingsAPI.subscribe(drain);
}

async function runTask(task: transcription.TranscriptionTask): Promise<void> {
    const media = project.getMedia(task.mediaId)!;
    const mediaPath = task.request.mediaPath;
    const { size, hash } = media;
    try {
        await Promise.resolve();
        if (transcription.getTaskById(task.id) !== task || task.status !== "running" || !project.getMedia(task.mediaId)) return;
        const result = await window.api.transcription.transcribe(task.id, transcription.snapshotRequest(task.request));
        const current = project.getMedia(task.mediaId);
        if (transcription.getTaskById(task.id) !== task || task.status !== "running"
            || !current || current.path !== mediaPath || current.size !== size || current.hash !== hash) return;
        if (result.success) {
            projectAPI.appendRun(task.mediaId, result.run);
            task.status = "succeeded";
        }
        else fail(task, result.error);
    }
    catch (error) {
        console.error("Unexpected transcription failure:", error);
        if (transcription.getTaskById(task.id) === task && task.status === "running") {
            fail(task, toFailureInfo(error));
        }
    }
    finally {
        if (transcription.getTaskById(task.id) === task && (task.status === "running" || task.status === "stopping")) task.status = "cancelled";
        transcription.state.activeCount--;
        finish(task);
        drain();
    }
}