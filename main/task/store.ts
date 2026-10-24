import { stripVTControlCharacters } from "node:util";
import { isTaskPending, type TaskSnapshot, type TaskStatus } from "../../shared/task";
import { type FailureInfo } from "../../shared/failure";
import { type LogDirectory, type LogFile, type LogKind } from "../logging";
import { type TaskLogReference } from "../../shared/transcription/Execution";

const outputLimit = 256 * 1024;
const historyLimit = 32;

type TaskRecord = {
    snapshot: TaskSnapshot;
    raw: string;
    dirty: boolean;
    log?: LogFile | null;
    timer?: ReturnType<typeof setTimeout>;
};

export class TaskOutputStore {
    private readonly tasks = new Map<string, TaskRecord>();
    private sequence = 0;
    private disposed = false;

    constructor(private readonly publish: (snapshot: TaskSnapshot) => void, private readonly logs?: LogDirectory) {}

    enqueue(id: string, kind: LogKind = "task"): void {
        if (this.disposed) return;
        const previous = this.tasks.get(id);
        if (!id || id.length > 128 || previous && isTaskPending(previous.snapshot.status)) throw new Error("Invalid or active task ID.");
        if (previous?.timer) clearTimeout(previous.timer);
        this.tasks.delete(id);
        const task: TaskRecord = { raw: "", dirty: false, snapshot: { id, sequence: ++this.sequence, status: "queued", progress: null, output: "", error: null } };
        task.log = this.logs?.create(kind, id);
        this.tasks.set(id, task);
        this.publish({ ...task.snapshot });
    }

    start(id: string): void {
        const task = this.pending(id);
        if (!task || task.snapshot.status !== "queued") return;
        task.snapshot.status = "running";
        task.snapshot.sequence = ++this.sequence;
        this.publish(this.snapshot(task));
    }

    append(id: string, text: string): void {
        const task = this.pending(id);
        if (!task || !text) return;
        task.log?.write(text);
        task.raw = (task.raw + text).slice(-outputLimit);
        task.dirty = true;
        this.changed(task);
    }

    record(id: string, event: string, value: unknown): void {
        this.pending(id)?.log?.record(event, value);
    }

    progress(id: string, value: number | null): void {
        const task = this.pending(id);
        if (!task || task.snapshot.status !== "running" || (value !== null && (!Number.isFinite(value) || value < 0 || value >= 1))) return;
        if (task.snapshot.progress === value) return;
        task.snapshot.progress = value;
        this.changed(task);
    }

    finish(id: string, status: Exclude<TaskStatus, "queued" | "running">, error: FailureInfo | null = null): void {
        const task = this.pending(id);
        if (!task) return;
        if (task.timer) clearTimeout(task.timer);
        task.timer = undefined;
        task.snapshot.status = status;
        task.snapshot.error = status === "failed" ? error : null;
        task.log?.close(status);
        if (status === "succeeded") task.snapshot.progress = 1;
        task.snapshot.sequence = ++this.sequence;
        this.publish(this.snapshot(task));
        this.tasks.delete(id);
        this.tasks.set(id, task);
        // Retain recent completed output, without evicting an active task.
        const finished = [...this.tasks.values()].filter(item => !isTaskPending(item.snapshot.status));
        for (const old of finished.slice(0, Math.max(0, finished.length - historyLimit))) this.tasks.delete(old.snapshot.id);
    }

    get(id: string): TaskSnapshot | null {
        const task = this.tasks.get(id);
        return task ? this.snapshot(task) : null;
    }

    logReference(id: string): TaskLogReference | null {
        const log = this.tasks.get(id)?.log;
        return log ? { taskId: id, path: log.path } : null;
    }

    dispose(): void {
        this.disposed = true;
        for (const task of this.tasks.values()) {
            if (task.timer) clearTimeout(task.timer);
            if (isTaskPending(task.snapshot.status)) task.log?.close("interrupted");
        }
        this.tasks.clear();
    }

    private pending(id: string): TaskRecord | undefined {
        const task = this.tasks.get(id);
        return !this.disposed && task && isTaskPending(task.snapshot.status) ? task : undefined;
    }

    private snapshot(task: TaskRecord): TaskSnapshot {
        if (task.dirty) {
            // Normalize only the display copy, combining escape sequences split across reads.
            task.snapshot.output = stripVTControlCharacters(task.raw).replace(/\r\n?/g, "\n");
            task.dirty = false;
        }
        return { ...task.snapshot };
    }

    private changed(task: TaskRecord): void {
        task.snapshot.sequence = ++this.sequence;
        if (task.timer) return;
        task.timer = setTimeout(() => {
            task.timer = undefined;
            if (!this.disposed) this.publish(this.snapshot(task));
        }, 100);
        task.timer.unref();
    }
}