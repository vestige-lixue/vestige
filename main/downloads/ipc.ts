import { shell, type WebContents } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { downloadChannels, type DownloadKind, type DownloadListResult, type DownloadStartResult } from "../../shared/downloads";
import { toFailureInfo, VestigeErrors, type OperationResult } from "../../shared/failure";
import { type AppPaths } from "../paths";
import { fileOperationFailure, lstatOrNull } from "../util/fs";
import { isSystemError } from "../util/file";
import { handle } from "../util/ipc";
import { type TaskOutputStore } from "../task/store";
import { modelDownloads } from "../models/catalog";
import { backendDownloads } from "../backends/catalog";
import { type DownloadRoots, type DownloadSource } from "./types";
import { installDownload } from "./install";
import { aria2Transfer } from "./aria2";
import { type TaskAdmission } from "../task/admission";

type ActiveDownload = {
    taskId: string;
    controller: AbortController;
    completion: Promise<void>;
};

export function registerDownloadIPCs(contents: WebContents, paths: Pick<AppPaths, "modelDirectory" | "backendDirectory" | "runtimeDirectory" | "runtimeCacheDirectory">, tasks: TaskOutputStore, admission: TaskAdmission): () => Promise<void> {
    const { runtimeDirectory, runtimeCacheDirectory } = paths;
    const roots: DownloadRoots = { model: paths.modelDirectory, backend: paths.backendDirectory };
    const sources: DownloadSource[] = [
        ...modelDownloads.map(model => ({ kind: "model" as const, id: model.id, name: model.name, estimatedBytes: model.estimatedBytes, resolve: async () => model })),
        ...backendDownloads(async (url, signal) => {
            let response: Response;
            try {
                response = await contents.session.fetch(url, {
                    headers: { Accept: "application/vnd.github+json", "User-Agent": "Vestige" },
                    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)])
                });
            }
            catch (error) {
                signal.throwIfAborted();
                throw new VestigeErrors({ kind: "download-http", stage: "metadata", reason: "request", resource: url, status: null, diagnostic: error instanceof Error ? error.message : String(error) }, { cause: error });
            }
            if (!response.ok) throw new VestigeErrors({ kind: "download-http", stage: "metadata", reason: "http", resource: url, status: response.status });
            try {
                return await response.json();
            }
            catch (error) {
                signal.throwIfAborted();
                throw new VestigeErrors({ kind: "download-http", stage: "metadata", reason: "metadata", resource: url, status: response.status, diagnostic: error instanceof Error ? error.message : String(error) }, { cause: error });
            }
        })
    ];
    const active = new Map<string, ActiveDownload>();
    const latest = new Map<string, string>();
    let closing = false;
    const key = (kind: DownloadKind, id: string): string => `${kind}:${id}`;
    const cancel = (task: ActiveDownload): Promise<void> => {
        task.controller.abort();
        return task.completion;
    };
    handle(contents, downloadChannels.list, async (): Promise<DownloadListResult> => {
        try {
            const downloads = await Promise.all(sources.map(async ({ kind, id, name, estimatedBytes, requiredFiles }) => {
                const taskId = latest.get(key(kind, id));
                const task = taskId ? tasks.get(taskId) : null;
                const directory = await lstatOrNull(join(roots[kind], id));
                const installed = !!directory?.isDirectory() && (await Promise.all((requiredFiles ?? []).map(async name => {
                    const file = await lstatOrNull(join(roots[kind], id, name));
                    return !!file?.isFile() && file.size > 0;
                }))).every(Boolean);
                // A previous success must not prevent downloading a package the user has moved or deleted.
                return { kind, id, name, estimatedBytes, installed, taskId: task && (installed || task.status !== "succeeded") ? task.id : null };
            }));
            return { success: true, downloads };
        }
        catch (error) {
            if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "inspect", error.path ?? null) };
            throw error;
        }
    });
    handle(contents, downloadChannels.start, (kind: unknown, id: unknown): DownloadStartResult => {
        if (closing) return { success: false, error: { kind: "download-closing" } };
        const source = sources.find(source => source.kind === kind && source.id === id);
        if (!source) return { success: false, error: { kind: "download-invalid-request" } };
        const resourceKey = key(source.kind, source.id);
        const previous = active.get(resourceKey);
        if (previous) return { success: true, taskId: previous.taskId };
        const root = roots[source.kind];
        const taskId = `download-${randomUUID()}`;
        const controller = new AbortController();
        tasks.enqueue(taskId, "download");
        tasks.record(taskId, "Download", { kind: source.kind, id: source.id, name: source.name, directory: root });
        latest.set(resourceKey, taskId);
        const task: ActiveDownload = { taskId, controller, completion: Promise.resolve() };
        active.set(resourceKey, task);
        const fail = (error: unknown): void => {
            const failure = toFailureInfo(error);
            tasks.record(taskId, "Error", failure);
            tasks.append(taskId, `${error instanceof Error ? error.message : String(error)}\n`);
            tasks.finish(taskId, controller.signal.aborted && error === controller.signal.reason ? "cancelled" : "failed", failure);
        };
        task.completion = admission.run(controller.signal, async () => {
            tasks.start(taskId);
            try {
                const warning = await installDownload(source, { rootDirectory: root, runtimeDirectory, runtimeCacheDirectory }, aria2Transfer(runtimeDirectory, url => contents.session.resolveProxy(url)), {
                    append: text => tasks.append(taskId, text),
                    progress: value => tasks.progress(taskId, value)
                }, controller.signal);
                if (warning) {
                    tasks.record(taskId, "Warning", warning);
                    tasks.append(taskId, `Warning: ${JSON.stringify(warning)}\n`);
                }
                tasks.finish(taskId, "succeeded");
            }
            catch (error) {
                fail(error);
            }
        }).catch(fail).finally(() => {
            active.delete(resourceKey);
        });
        return { success: true, taskId };
    });
    handle(contents, downloadChannels.cancel, async (taskId: unknown): Promise<OperationResult> => {
        if (typeof taskId !== "string") return { success: false, error: { kind: "download-invalid-request" } };
        for (const task of active.values()) if (task.taskId === taskId) await cancel(task);
        return { success: true };
    });
    handle(contents, downloadChannels.openDirectory, async (kind: unknown): Promise<OperationResult> => {
        if (kind !== "model" && kind !== "backend") return { success: false, error: { kind: "download-invalid-request" } };
        const directory = roots[kind];
        try {
            await mkdir(directory, { recursive: true });
        }
        catch (error) {
            if (isSystemError(error)) return { success: false, error: fileOperationFailure(error, "write", directory) };
            throw error;
        }
        try {
            const diagnostic = await shell.openPath(directory);
            return diagnostic ? { success: false, error: { kind: "file-operation-failed", operation: "open-directory", path: directory, diagnostic } } : { success: true };
        }
        catch (error) {
            return { success: false, error: { kind: "file-operation-failed", operation: "open-directory", path: directory, diagnostic: error instanceof Error ? error.message : String(error) } };
        }
    });
    const cancelAll = (): void => {
        for (const task of active.values()) task.controller.abort();
    };
    contents.once("destroyed", () => {
        closing = true;
        cancelAll();
    });
    contents.on("render-process-gone", cancelAll);
    contents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) cancelAll();
    });
    return async () => {
        closing = true;
        cancelAll();
        await Promise.allSettled([...active.values()].map(cancel));
    };
}