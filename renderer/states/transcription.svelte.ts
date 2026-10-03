import { type TranscriptionRequest } from "../../shared/transcription/executer";
import { mediaImports, type MediaItemState } from "./media.svelte";

export type TranscriptionTask = {
    id: string;
    item: MediaItemState;
    status: "running" | "stopping" | "failed";
    error: string | null;
};

class Transcriptions {
    tasks = $state<TranscriptionTask[]>([]);
    #promises = new Map<string, Promise<void>>();

    get pending(): boolean {
        return this.tasks.some(task => task.status !== "failed");
    }

    taskFor(item: MediaItemState): TranscriptionTask | null {
        return this.tasks.find(task => task.item === item) ?? null;
    }

    label(item: MediaItemState | null): string {
        if (!item) return "开始转写";
        const task = this.taskFor(item);
        if (task) return task.status === "failed" ? "失败详情" : "停止转写";
        return item.vestige?.runs.length ? "继续转写" : "开始转写";
    }

    start(item: MediaItemState, configuration: Omit<TranscriptionRequest, "mediaPath">): Promise<void> | null {
        const previous = this.taskFor(item);
        if (!mediaImports.items.includes(item) || !item.vestige || item.stage !== "ready" || item.ignored
            || (previous && previous.status !== "failed")) return null;
        if (previous) this.#remove(previous);
        this.tasks.push({ id: crypto.randomUUID(), item, status: "running", error: null });
        const task = this.tasks[this.tasks.length - 1];
        const promise = this.#run(task, configuration);
        this.#promises.set(task.id, promise);
        return promise;
    }

    stop(item: MediaItemState): void {
        const task = this.taskFor(item);
        if (!task || task.status !== "running") return;
        task.status = "stopping";
        window.api.transcription.cancel(task.id);
    }

    remove(item: MediaItemState): void {
        const task = this.taskFor(item);
        if (task?.status === "failed") this.#remove(task);
        else this.stop(item);
    }

    clear(): void {
        for (const task of this.tasks) this.stop(task.item);
        this.tasks = [];
    }

    #remove(task: TranscriptionTask): void {
        const index = this.tasks.indexOf(task);
        if (index >= 0) this.tasks.splice(index, 1);
    }

    async #run(task: TranscriptionTask, configuration: Omit<TranscriptionRequest, "mediaPath">): Promise<void> {
        const vestige = task.item.vestige!;
        const mediaPath = vestige.media.path;
        const hash = vestige.media.hash;
        try {
            await Promise.resolve();
            if (this.taskFor(task.item) !== task || task.status !== "running" || !mediaImports.items.includes(task.item)) return;
            const run = await window.api.transcription.transcribe(task.id, { ...configuration, mediaPath });
            if (this.taskFor(task.item) !== task || task.status !== "running" || !mediaImports.items.includes(task.item)
                || task.item.vestige !== vestige || vestige.media.path !== mediaPath || vestige.media.hash !== hash) return;
            vestige.runs.push(run);
            this.#remove(task);
        }
        catch (error) {
            if (this.taskFor(task.item) !== task || task.status !== "running" || !mediaImports.items.includes(task.item)) return;
            task.status = "failed";
            task.error = error instanceof Error ? error.message : String(error);
        }
        finally {
            if (task.status !== "failed" || !mediaImports.items.includes(task.item)) this.#remove(task);
            this.#promises.delete(task.id);
        }
    }
}

export const transcriptions = new Transcriptions();