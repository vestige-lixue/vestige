export type ScheduledTask<Value> = {
    readonly id: string;
    readonly value: Value;
    readonly signal: AbortSignal;
    readonly completed: Promise<void>;
};

type Entry<Value> = {
    task: ScheduledTask<Value>;
    controller: AbortController;
    resolve: () => void;
    state: "queued" | "running" | "finished";
    priority: number;
    order: number;
};

export class TaskQueue<Value> {
    private readonly entries = new Map<string, Entry<Value>>();
    private active = 0;
    private order = 0;
    private concurrency: number;

    constructor(private readonly options: {
        concurrency: number;
        run: (task: ScheduledTask<Value>) => Promise<void>;
        settled?: (task: ScheduledTask<Value>, current: boolean) => void;
        activeChanged?: (count: number) => void;
    }) {
        this.concurrency = options.concurrency;
    }

    enqueue(id: string, value: Value): ScheduledTask<Value> {
        const previous = this.entries.get(id);
        if (previous) this.cancelEntry(previous);
        const controller = new AbortController();
        let resolve!: () => void;
        const completed = new Promise<void>(done => resolve = done);
        const task = { id, value, signal: controller.signal, completed };
        this.entries.set(id, { task, controller, resolve, state: "queued", priority: 0, order: this.order++ });
        this.pump();
        return task;
    }

    get(id: string): ScheduledTask<Value> | undefined {
        return this.entries.get(id)?.task;
    }

    isCurrent(task: ScheduledTask<Value>): boolean {
        return this.get(task.id) === task && !task.signal.aborted;
    }

    setConcurrency(value: number): void {
        if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Invalid task concurrency.");
        this.concurrency = value;
        this.pump();
    }

    setPriority(id: string, priority: number): void {
        const entry = this.entries.get(id);
        if (!entry) return;
        entry.priority = priority;
        this.pump();
    }

    cancel(id: string): void {
        const entry = this.entries.get(id);
        if (entry) this.cancelEntry(entry);
        this.pump();
    }

    clear(): void {
        const entries = [...this.entries.values()];
        this.entries.clear();
        for (const entry of entries) this.cancelEntry(entry);
    }

    private cancelEntry(entry: Entry<Value>): void {
        if (this.entries.get(entry.task.id) === entry) this.entries.delete(entry.task.id);
        entry.controller.abort();
        if (entry.state === "queued") this.finish(entry);
        // A running task retains its slot until its underlying Promise settles.
    }

    private pump(): void {
        while (this.active < this.concurrency) {
            const next = [...this.entries.values()].filter(entry => entry.state === "queued")
                .sort((left, right) => right.priority - left.priority || left.order - right.order)[0];
            if (!next) return;
            next.state = "running";
            this.active++;
            this.options.activeChanged?.(this.active);
            void Promise.resolve().then(() => {
                return this.isCurrent(next.task) ? this.options.run(next.task) : undefined;
            }).catch(console.error).finally(() => {
                this.active--;
                this.options.activeChanged?.(this.active);
                this.finish(next);
                this.pump();
            });
        }
    }

    private finish(entry: Entry<Value>): void {
        if (entry.state === "finished") return;
        entry.state = "finished";
        const current = this.entries.get(entry.task.id) === entry;
        if (current) this.entries.delete(entry.task.id);
        try {
            this.options.settled?.(entry.task, current);
        }
        catch (error) {
            console.error(error);
        }
        finally {
            entry.resolve();
        }
    }
}