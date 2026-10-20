import { type FailureInfo, VestigeErrors, toFailureInfo } from "../../shared/failure";
import { type MediaIssueStatus } from "../../shared/media/check";
import { type InputSource } from "../../shared/util/file";
import { getFileName, type AbsolutePath } from "../../shared/util/path";
import * as project from "./project.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as dialogsAPI from "./dialogs";
import * as projectAPI from "./project";

type TaskSource = ({
    kind: "import";
    source: InputSource;
} | {
    kind: "check";
    path: AbsolutePath;
} | {
    kind: "relink";
    previous: mediaImport.ImportIssue;
});

type ImportTask = { source: TaskSource; controller: AbortController; started: boolean };

const tasks = new Map<string, ImportTask>();
const issueDialogs = new Map<string, string>();
const failureDialogs = new Map<mediaImport.MediaImportFailure, string>();
let running = 0;
let collection: AbortController | null = null;

export function rename(id: string, name: string): void {
    const task = tasks.get(id);
    if (task && task.source.kind === "import") mediaImport.names.set(id, name);
}

export function setConcurrency(value: number): void {
    if (!Number.isSafeInteger(value) || value < 1) throw new VestigeErrors({ kind: "media-invalid-concurrency" });
    mediaImport.state.concurrency = value;
    pump();
}

export function setPicking(value: boolean): void {
    mediaImport.state.picking = value;
}

export function beginCollection(): AbortController | null {
    if (collection) return null;
    collection = new AbortController();
    mediaImport.state.collecting = true;
    return collection;
}

export function endCollection(controller: AbortController): void {
    if (collection !== controller) return;
    collection = null;
    mediaImport.state.collecting = false;
}

function update(item: mediaImport.ImportState): void {
    const index = mediaImport.state.items.findIndex(current => current.id === item.id);
    if (index >= 0) mediaImport.state.items[index] = item;
}

function closeIssue(id: string): void {
    const dialog = issueDialogs.get(id);
    if (dialog) dialogsAPI.close(dialog);
    issueDialogs.delete(id);
}

function showIssue(id: string): void {
    const item = mediaImport.get(id);
    if (!item || !mediaImport.isIssue(item) || issueDialogs.has(id)) return;
    const dialog = dialogsAPI.show({
        kind: "media-ref-import-error",
        issue: { status: item.stage, mediaId: id, path: item.path, error: item.error },
        onRetry: () => projectAPI.retryMedia(id), onRelink: () => projectAPI.relinkMedia(id), onIgnore: () => projectAPI.ignoreMedia(id),
        onClosed: () => {
            if (issueDialogs.get(id) === dialog) issueDialogs.delete(id);
        }
    });
    issueDialogs.set(id, dialog);
}

export function reset(ids: string[]): void {
    collection?.abort();
    collection = null;
    mediaImport.state.collecting = false;
    for (const task of tasks.values()) task.controller.abort();
    tasks.clear();
    mediaImport.names.clear();
    for (const dialog of [...issueDialogs.values(), ...failureDialogs.values()]) dialogsAPI.close(dialog);
    issueDialogs.clear();
    failureDialogs.clear();
    mediaImport.state.importFailures = [];
    mediaImport.state.items = ids.map(id => ({ id, stage: "queued" }));
    for (const id of ids) enqueue(id, { kind: "check", path: project.getMedia(id)!.path }, "");
    pump();
}

export function add(sources: InputSource[]): void {
    for (const source of sources) {
        const id = crypto.randomUUID();
        mediaImport.state.items.push({ id, stage: "queued" });
        enqueue(id, { kind: "import", source }, typeof source === "string" ? getFileName(source) : source.name);
    }
    pump();
}

export function retry(id: string): void {
    const item = mediaImport.get(id);
    if (!item || !mediaImport.isIssue(item)) return;
    enqueue(id, { kind: "check", path: item.path }, "");
    pump();
}

export function relink(id: string): void {
    const item = mediaImport.get(id);
    if (!item || !mediaImport.isIssue(item)) return;
    enqueue(id, { kind: "relink", previous: item }, "");
    pump();
}

export function ignore(id: string): void {
    const item = mediaImport.get(id);
    if (!item || !mediaImport.isIssue(item)) return;
    item.ignored = true;
    closeIssue(id);
}

export function review(id: string): void {
    const item = mediaImport.get(id);
    if (!item || !mediaImport.isIssue(item)) return;
    item.ignored = false;
    showIssue(id);
}

export function reportPlaybackFailure(id: string, status: MediaIssueStatus, error: FailureInfo): void {
    const media = project.getMedia(id);
    if (media && mediaImport.isReady(id)) reportFailure(id, status, error, media.path);
}

export function remove(id: string): void {
    const task = tasks.get(id);
    tasks.delete(id);
    mediaImport.names.delete(id);
    closeIssue(id);
    mediaImport.state.items = mediaImport.state.items.filter(item => item.id !== id);
    task?.controller.abort();
    pump();
}

export function move(id: string, beforeId: string | null): boolean {
    const items = mediaImport.state.items;
    const from = items.findIndex(item => item.id === id);
    const before = beforeId === null ? items.length : items.findIndex(item => item.id === beforeId);
    if (from < 0 || before < 0 || from === before || from + 1 === before) return false;
    const [item] = items.splice(from, 1);
    items.splice(before > from ? before - 1 : before, 0, item);
    return true;
}

export function reportImportFailure(input: mediaImport.MediaImportFailure): void {
    mediaImport.state.importFailures.push(input);
    const failure = mediaImport.state.importFailures[mediaImport.state.importFailures.length - 1];
    const dialog = dialogsAPI.show({
        kind: "media-import-error", failure, onClosed: () => {
            const index = mediaImport.state.importFailures.indexOf(failure);
            if (index >= 0) mediaImport.state.importFailures.splice(index, 1);
            failureDialogs.delete(failure);
        }
    });
    failureDialogs.set(failure, dialog);
}

function reportFailure(id: string, status: MediaIssueStatus, error: FailureInfo, path: AbsolutePath | null): void {
    const media = project.getMedia(id);
    if (media) {
        update({ id, stage: status, error, path: path ?? media.path, ignored: false });
        if (mediaSelection.get() === id) projectAPI.selectMedia(null);
        showIssue(id);
    }
    else {
        reportImportFailure({ name: mediaImport.getName(id), path, error });
        remove(id);
    }
}

function enqueue(id: string, source: TaskSource, name: string): void {
    closeIssue(id);
    update({ id, stage: "queued" });
    const task: ImportTask = { source, controller: new AbortController(), started: false };
    tasks.set(id, task);
    mediaImport.names.set(id, name);
}

function pump(): void {
    for (const [id, task] of tasks) {
        if (running >= mediaImport.state.concurrency) break;
        if (task.started) continue;
        task.started = true;
        running++;
        void run(id, task);
    }
}

async function run(id: string, task: ImportTask): Promise<void> {
    let path: AbsolutePath | null = null;
    try {
        let source: InputSource;
        if (task.source.kind === "relink") {
            update({ id, stage: "relocating" });
            const selected = await window.api.file.selectMediaPath(task.source.previous.path);
            if (tasks.get(id) !== task) return;
            if (selected === null) {
                update(task.source.previous);
                showIssue(id);
                return;
            }
            source = selected;
        }
        else source = task.source.kind === "check" ? task.source.path : task.source.source;
        update({ id, stage: "path" });
        if (typeof source === "string") path = source;
        else {
            const result = await window.api.file.getPathForFile(source);
            if (!result.success) throw new VestigeErrors(result.error);
            path = result.path;
        }
        if (tasks.get(id) !== task) return;
        if (task.source.kind === "import" && /\.vestige$/i.test(path)) {
            reportFailure(id, "unreadable", { kind: "media-format" }, path);
            return;
        }
        update({ id, stage: "reading" });
        const requestId = crypto.randomUUID();
        const cancel = (): void => window.api.file.cancelMediaRead(requestId);
        task.controller.signal.addEventListener("abort", cancel, { once: true });
        const expected = project.getMedia(id);
        const result = await window.api.file.readMedia(requestId, path, expected ? { size: expected.size, hash: expected.hash } : null)
            .finally(() => task.controller.signal.removeEventListener("abort", cancel));
        if (tasks.get(id) !== task) return;
        if (result.status !== "ready") {
            if (result.status !== "cancelled") reportFailure(id, result.status, result.error, path);
            return;
        }
        if (expected) projectAPI.updateMediaPath(id, result.media.path);
        else {
            const ids = mediaImport.getIds();
            const index = ids.slice(0, ids.indexOf(id)).filter(id => project.getMedia(id) !== null).length;
            projectAPI.appendMedia({ ...result.media, id, name: mediaImport.getName(id) }, index);
        }
        update({ id, stage: "ready" });
        if (mediaSelection.get() === null) projectAPI.selectMedia(id);
    }
    catch (error) {
        if (tasks.get(id) !== task || task.controller.signal.aborted) return;
        reportFailure(id, "unreadable", toFailureInfo(error), path);
        console.error(error);
    }
    finally {
        if (tasks.get(id) === task) {
            tasks.delete(id);
            mediaImport.names.delete(id);
        }
        running--;
        pump();
    }
}