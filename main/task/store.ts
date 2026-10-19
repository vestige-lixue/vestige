import { stripVTControlCharacters } from "node:util";
import { type TaskSnapshot, type TaskStatus } from "../../shared/task";
import { type FailureInfo } from "../../shared/failure";
import { type LogDirectory, type LogFile, type LogKind } from "../logging";

const outputLimit = 256 * 1024;
const historyLimit = 32;
const activeLimit = 128;

type TaskRecord = {
    snapshot: TaskSnapshot;
    raw: string;
    log?: LogFile | null;
    timer?: ReturnType<typeof setTimeout>;
};

export class TaskOutputStore {
    private readonly tasks = new Map<string, TaskRecord>();
    private sequence = 0;
    private disposed = false;

    constructor(private readonly publish: (snapshot: TaskSnapshot) => void, private readonly logs?: LogDirectory) {}

    start(id: string, kind: LogKind = "task"): void {
        if (this.disposed) return;
        if (!id || id.length > 128 || this.tasks.get(id)?.snapshot.status === "running") throw new Error("Invalid or active task ID.");
        if ([...this.tasks.values()].filter(task => task.snapshot.status === "running").length >= activeLimit) throw new Error("Too many active tasks.");
        const previous = this.tasks.get(id);
        if (previous?.timer) clearTimeout(previous.timer);
        this.tasks.delete(id);
        const task: TaskRecord = { raw: "", snapshot: { id, sequence: ++this.sequence, status: "running", progress: null, output: "", error: null } };
        task.log = this.logs?.create(kind, id);
        this.tasks.set(id, task);
        this.publish({ ...task.snapshot });
    }

    append(id: string, text: string): void {
        const task = this.running(id);
        if (!task || !text) return;
        task.log?.write(text);
        task.raw = (task.raw + text).slice(-outputLimit);
        // Normalize only the display copy: Sherpa still needs the original stdout JSON.
        // Keeping raw chunks together also handles escape sequences split between reads.
        task.snapshot.output = stripVTControlCharacters(task.raw).replace(/\r\n?/g, "\n");
        this.changed(task);
    }

    record(id: string, event: string, value: unknown): void {
        this.running(id)?.log?.record(event, value);
    }

    progress(id: string, value: number | null): void {
        const task = this.running(id);
        if (!task || (value !== null && (!Number.isFinite(value) || value < 0 || value >= 1))) return;
        if (task.snapshot.progress === value) return;
        task.snapshot.progress = value;
        this.changed(task);
    }

    finish(id: string, status: Exclude<TaskStatus, "running">, error: FailureInfo | null = null): void {
        const task = this.running(id);
        if (!task) return;
        if (task.timer) clearTimeout(task.timer);
        task.timer = undefined;
        task.snapshot.status = status;
        task.snapshot.error = status === "failed" ? error : null;
        task.log?.close(status);
        if (status === "succeeded") task.snapshot.progress = 1;
        task.snapshot.sequence = ++this.sequence;
        this.publish({ ...task.snapshot });
        this.tasks.delete(id);
        this.tasks.set(id, task);
        // Retain recent completed output, without evicting an active task.
        const finished = [...this.tasks.values()].filter(item => item.snapshot.status !== "running");
        for (const old of finished.slice(0, Math.max(0, finished.length - historyLimit))) this.tasks.delete(old.snapshot.id);
    }

    get(id: string): TaskSnapshot | null {
        const task = this.tasks.get(id);
        return task ? { ...task.snapshot } : null;
    }

    dispose(): void {
        this.disposed = true;
        for (const task of this.tasks.values()) {
            if (task.timer) clearTimeout(task.timer);
            if (task.snapshot.status === "running") task.log?.close("interrupted");
        }
        this.tasks.clear();
    }

    private running(id: string): TaskRecord | undefined {
        const task = this.tasks.get(id);
        return !this.disposed && task?.snapshot.status === "running" ? task : undefined;
    }

    private changed(task: TaskRecord): void {
        task.snapshot.sequence = ++this.sequence;
        if (task.timer) return;
        task.timer = setTimeout(() => {
            task.timer = undefined;
            if (!this.disposed) this.publish({ ...task.snapshot });
        }, 100);
        task.timer.unref();
    }
}