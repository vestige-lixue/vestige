import { type FailureInfo, toFailureInfo } from "../../shared/failure";
import { taskCapacity } from "../../shared/task";
import { type Config } from "../../shared/transcription/Config";
import * as mediaImport from "./mediaImport.svelte";
import * as project from "./project.svelte";
import * as settings from "./settings.svelte";
import * as transcription from "./transcription.svelte";
import * as settingsAPI from "./settings";
import * as projectAPI from "./project";
import { TaskQueue, type ScheduledTask } from "./taskQueue";

const queue = new TaskQueue<transcription.TranscriptionTask>({
    concurrency: 0,
    run: runTask,
    activeChanged: count => transcription.state.activeCount = count,
    settled: ({ value: task }) => {
        if (transcription.getTaskById(task.id) === task && (task.status === "running" || task.status === "stopping")) task.status = "cancelled";
    }
});

export function start(mediaId: string, config: Config): Promise<void> | null {
    const previous = transcription.getTask(mediaId);
    const media = project.getMedia(mediaId);
    if (!settings.isReady() || !media || !mediaImport.isReady(mediaId)
        || transcription.isPending(previous)) return null;
    const id = crypto.randomUUID();
    transcription.tasks.push({
        id,
        mediaId,
        mediaName: media.name,
        request: { ...config, params: { ...config.params }, mediaPath: media.path, mediaDuration: media.duration },
        status: "queued"
    });
    updateConcurrency();
    // Queue the reactive task identity, not the object supplied to the state array.
    return queue.enqueue(id, transcription.getTaskById(id)!).completed;
}

export function stop(mediaId: string): void {
    const task = transcription.getTask(mediaId);
    if (task) stopTask(task.id);
}

export function stopTask(taskId: string): void {
    const task = transcription.getTaskById(taskId);
    if (!task) return;
    if (task.status === "queued") task.status = "cancelled";
    else if (task.status === "running") task.status = "stopping";
    else return;
    queue.cancel(task.id);
}

export function remove(taskId: string): void {
    const task = transcription.getTaskById(taskId);
    if (!task || task.status === "running" || task.status === "stopping") return;
    if (task.status === "queued") {
        task.status = "cancelled";
        queue.cancel(task.id);
    }
    transcription.tasks.splice(transcription.tasks.indexOf(task), 1);
}

export function stopAll(): void {
    for (const task of transcription.tasks) {
        if (task.status === "queued") task.status = "cancelled";
        else if (task.status === "running") task.status = "stopping";
    }
    queue.clear();
}

function fail(task: transcription.TranscriptionTask, error: FailureInfo): void {
    const index = transcription.tasks.indexOf(task);
    if (index >= 0) transcription.tasks[index] = { ...task, status: "failed", error };
}

function updateConcurrency(): void {
    queue.setConcurrency(Math.min(taskCapacity, settings.getConfirmed()?.transcription.concurrency ?? 0));
}

export function startLifecycle(): () => void {
    return settingsAPI.subscribe(updateConcurrency);
}

async function runTask(scheduled: ScheduledTask<transcription.TranscriptionTask>): Promise<void> {
    const task = scheduled.value;
    const media = project.getMedia(task.mediaId);
    if (!media || media.path !== task.request.mediaPath || !mediaImport.isReady(task.mediaId)) {
        fail(task, { kind: "transcription-media-unavailable" });
        return;
    }
    task.status = "running";
    const mediaPath = task.request.mediaPath;
    const { size, hash } = media;
    const cancel = (): void => window.api.transcription.cancel(task.id);
    scheduled.signal.addEventListener("abort", cancel, { once: true });
    try {
        await Promise.resolve();
        if (!queue.isCurrent(scheduled) || transcription.getTaskById(task.id) !== task || task.status !== "running" || !project.getMedia(task.mediaId)) return;
        const result = await window.api.transcription.transcribe(task.id, transcription.snapshotRequest(task.request));
        const current = project.getMedia(task.mediaId);
        if (!queue.isCurrent(scheduled) || transcription.getTaskById(task.id) !== task || task.status !== "running"
            || !current || current.path !== mediaPath || current.size !== size || current.hash !== hash) return;
        if (result.success) {
            projectAPI.appendRun(task.mediaId, result.run);
            task.status = "succeeded";
        }
        else fail(task, result.error);
    }
    catch (error) {
        console.error("Unexpected transcription failure:", error);
        if (queue.isCurrent(scheduled) && transcription.getTaskById(task.id) === task && task.status === "running") {
            fail(task, toFailureInfo(error));
        }
    }
    finally {
        scheduled.signal.removeEventListener("abort", cancel);
    }
}