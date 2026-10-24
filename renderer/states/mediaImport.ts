import { TaskQueue, type ScheduledTask } from "./taskQueue";
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

type ImportTask = ScheduledTask<TaskSource>;

const tasks = new TaskQueue<TaskSource>({
    concurrency: 2,
    run: task => run(task.id, task),
    settled: (task, current) => {
        if (current) mediaImport.names.delete(task.id);
    }
});
const issueDialogs = new Map<string, string>();
const failureDialogs = new Map<mediaImport.MediaImportFailure, string>();
let collection: AbortController | null = null;

export function rename(id: string, name: string): void {
    const task = tasks.get(id);
    if (task && task.value.kind === "import") mediaImport.names.set(id, name);
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
    tasks.clear();
    mediaImport.names.clear();
    for (const dialog of [...issueDialogs.values(), ...failureDialogs.values()]) dialogsAPI.close(dialog);
    issueDialogs.clear();
    failureDialogs.clear();
    mediaImport.state.importFailures = [];
    mediaImport.state.items = ids.map(id => ({ id, stage: "queued" }));
    for (const id of ids) enqueue(id, { kind: "check", path: project.getMedia(id)!.path }, "");
}

export function add(sources: InputSource[]): void {
    for (const source of sources) {
        const id = crypto.randomUUID();
        mediaImport.state.items.push({ id, stage: "queued" });
        enqueue(id, { kind: "import", source }, typeof source === "string" ? getFileName(source) : source.name);
    }
}

export function retry(id: string): void {
    const item = mediaImport.get(id);
    if (!item || !mediaImport.isIssue(item)) return;
    enqueue(id, { kind: "check", path: item.path }, "");
}

export function relink(id: string): void {
    const item = mediaImport.get(id);
    if (!item || !mediaImport.isIssue(item)) return;
    enqueue(id, { kind: "relink", previous: item }, "");
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
    tasks.cancel(id);
    mediaImport.names.delete(id);
    closeIssue(id);
    mediaImport.state.items = mediaImport.state.items.filter(item => item.id !== id);
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
    tasks.enqueue(id, source);
    mediaImport.names.set(id, name);
}

async function run(id: string, task: ImportTask): Promise<void> {
    let path: AbsolutePath | null = null;
    try {
        let source: InputSource;
        if (task.value.kind === "relink") {
            update({ id, stage: "relocating" });
            const selected = await window.api.file.selectMediaPath(task.value.previous.path);
            if (!tasks.isCurrent(task)) return;
            if (selected === null) {
                update(task.value.previous);
                showIssue(id);
                return;
            }
            source = selected;
        }
        else source = task.value.kind === "check" ? task.value.path : task.value.source;
        update({ id, stage: "path" });
        if (typeof source === "string") path = source;
        else {
            const result = await window.api.file.getPathForFile(source);
            if (!result.success) throw new VestigeErrors(result.error);
            path = result.path;
        }
        if (!tasks.isCurrent(task)) return;
        if (task.value.kind === "import" && /\.vestige$/i.test(path)) {
            reportFailure(id, "unreadable", { kind: "media-format" }, path);
            return;
        }
        update({ id, stage: "reading" });
        const requestId = crypto.randomUUID();
        const cancel = (): void => window.api.file.cancelMediaRead(requestId);
        task.signal.addEventListener("abort", cancel, { once: true });
        const expected = project.getMedia(id);
        const result = await window.api.file.readMedia(requestId, path, expected ? { size: expected.size, hash: expected.hash } : null)
            .finally(() => task.signal.removeEventListener("abort", cancel));
        if (!tasks.isCurrent(task)) return;
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
        if (!tasks.isCurrent(task) || task.signal.aborted) return;
        reportFailure(id, "unreadable", toFailureInfo(error), path);
        console.error(error);
    }
}