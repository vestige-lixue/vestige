import { type FailureInfo } from "./failure";

export type TaskStatus = "running" | "succeeded" | "failed" | "cancelled";

export type TaskSnapshot = {
    id: string;
    sequence: number;
    status: TaskStatus;
    // Normalized progress. null means the executor cannot determine it yet.
    progress: number | null;
    output: string;
    error: FailureInfo | null;
};

export const taskOutputChannels = {
    get: "task-output:get",
    changed: "task-output:changed"
} as const;