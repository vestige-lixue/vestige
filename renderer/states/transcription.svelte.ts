import { type FailureInfo } from "../../shared/failure";
import { type TranscriptionRequest } from "../../shared/transcription/executor";

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

export const tasks = $state<TranscriptionTask[]>([]);

// Stopping tasks still occupy a slot until their native invocation ends.
export const state = $state({ activeCount: 0 });

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

export function getTasks(): TranscriptionTask[] {
    return [...tasks].reverse();
}

export function hasPending(): boolean {
    return state.activeCount > 0 || tasks.some(isPending);
}

export function snapshotRequest(request: TranscriptionRequest): TranscriptionRequest {
    return $state.snapshot(request);
}