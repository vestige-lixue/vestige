import { shell, type WebContents, type IpcMainInvokeEvent } from "electron";
import { randomUUID } from "node:crypto";
import { lstat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { downloadChannels, type Download, type DownloadKind } from "../../shared/downloads";
import { toFailureInfo } from "../../shared/failure";
import { type AbsolutePath } from "../../shared/util/path";
import { type TaskOutputStore } from "../task/store";
import { modelDownloads } from "../models/catalog";
import { backendDownloads } from "../backends/catalog";
import { type DownloadRoots, type DownloadSource } from "./types";
import { installDownload } from "./install";
import { aria2Transfer } from "./aria2";
import { DownloadCleanupError } from "./cleanup";

type ActiveDownload = {
    taskId: string;
    controller: AbortController;
    completion: Promise<void>;
    cleanup: DownloadCleanupError | null;
    cancellation: Promise<void> | null;
};

export function registerDownloadIPCs(contents: WebContents, roots: DownloadRoots, runtimeDirectory: AbsolutePath, tasks: TaskOutputStore): () => Promise<void> {
    const sources: DownloadSource[] = [
        ...modelDownloads.map(model => ({ kind: "model" as const, id: model.id, name: model.name, estimatedBytes: model.estimatedBytes, resolve: async () => model })),
        ...backendDownloads(async (url, signal) => {
            const response = await contents.session.fetch(url, {
                headers: { Accept: "application/vnd.github+json", "User-Agent": "Vestige" },
                signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)])
            });
            if (!response.ok) throw new Error(`Backend metadata HTTP ${response.status}: ${url}`);
            return response.json();
        })
    ];
    const active = new Map<string, ActiveDownload>();
    const latest = new Map<string, string>();
    let closing = false;
    const checkSender = (event: IpcMainInvokeEvent): void => {
        if (event.senderFrame !== contents.mainFrame) throw new Error("Invalid IPC frame.");
    };
    const key = (kind: DownloadKind, id: string): string => `${kind}:${id}`;
    const cancel = (resourceKey: string, task: ActiveDownload): Promise<void> => {
        if (task.cancellation) return task.cancellation;
        task.controller.abort();
        task.cancellation = (async () => {
            await task.completion;
            if (task.cleanup) {
                await task.cleanup.retry();
                tasks.finish(task.taskId, task.cleanup.installed ? "succeeded" : "cancelled");
                task.cleanup = null;
                active.delete(resourceKey);
            }
        })().finally(() => task.cancellation = null);
        return task.cancellation;
    };
    contents.ipc.handle(downloadChannels.list, async (event): Promise<Download[]> => {
        checkSender(event);
        return Promise.all(sources.map(async ({ kind, id, name, estimatedBytes }) => {
            const taskId = latest.get(key(kind, id));
            const task = taskId ? tasks.get(taskId) : null;
            const installed = await lstat(join(roots[kind], id)).then(info => info.isDirectory()).catch((error: NodeJS.ErrnoException) => {
                if (error.code === "ENOENT") return false;
                throw error;
            });
            // A previous success must not prevent downloading a package the user has moved or deleted.
            return { kind, id, name, estimatedBytes, installed, taskId: task && (installed || task.status !== "succeeded") ? task.id : null };
        }));
    });
    contents.ipc.handle(downloadChannels.start, (event, kind: unknown, id: unknown): string => {
        checkSender(event);
        if (closing) throw new Error("The application is closing.");
        const source = sources.find(source => source.kind === kind && source.id === id);
        if (!source) throw new Error("Unknown download.");
        const resourceKey = key(source.kind, source.id);
        const previous = active.get(resourceKey);
        if (previous) return previous.taskId;
        const root = roots[source.kind];
        const taskId = `download-${randomUUID()}`;
        const controller = new AbortController();
        tasks.start(taskId, "download");
        tasks.record(taskId, "Download", { kind: source.kind, id: source.id, name: source.name, directory: root });
        latest.set(resourceKey, taskId);
        const task: ActiveDownload = { taskId, controller, completion: Promise.resolve(), cleanup: null, cancellation: null };
        active.set(resourceKey, task);
        task.completion = installDownload(source, root, runtimeDirectory, aria2Transfer(runtimeDirectory, url => contents.session.resolveProxy(url)), {
            append: text => tasks.append(taskId, text),
            progress: value => tasks.progress(taskId, value)
        }, controller.signal).then(() => {
            tasks.finish(taskId, "succeeded");
        }).catch((error: unknown) => {
            const failure = toFailureInfo(error);
            tasks.record(taskId, "Error", failure);
            tasks.append(taskId, `${error instanceof Error ? error.message : String(error)}\n`);
            if (error instanceof DownloadCleanupError) task.cleanup = error;
            else tasks.finish(taskId, controller.signal.aborted ? "cancelled" : "failed", failure);
        }).finally(() => {
            if (!task.cleanup) active.delete(resourceKey);
        });
        return taskId;
    });
    contents.ipc.handle(downloadChannels.cancel, async (event, taskId: unknown) => {
        checkSender(event);
        if (typeof taskId !== "string") throw new Error("Invalid download task.");
        for (const [resourceKey, task] of active) if (task.taskId === taskId) await cancel(resourceKey, task);
    });
    contents.ipc.handle(downloadChannels.openDirectory, async (event, kind: unknown) => {
        checkSender(event);
        if (kind !== "model" && kind !== "backend") throw new Error("Unknown download kind.");
        await mkdir(roots[kind], { recursive: true });
        const error = await shell.openPath(roots[kind]);
        if (error) throw new Error(error);
    });
    const cancelAll = (): void => {
        for (const task of active.values()) task.controller.abort();
    };
    contents.once("destroyed", cancelAll);
    return async () => {
        closing = true;
        cancelAll();
        await Promise.allSettled([...active].map(([resourceKey, task]) => cancel(resourceKey, task)));
    };
}