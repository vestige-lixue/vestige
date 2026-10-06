import { type Failure, FailureError, toFailure } from "../../shared/failure";
import { SvelteMap } from "svelte/reactivity";
import { type MediaIssueStatus } from "../../shared/media/check";
import { type InputSource } from "../../shared/util/file";
import { getFileName, type AbsolutePath } from "../../shared/util/path";
import * as project from "./project.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as dialogs from "./dialogs.svelte";

export type ImportState = { id: string } & ({
    stage: "queued" | "path" | "reading" | "relocating" | "ready";
} | {
    stage: MediaIssueStatus;
    error: Failure;
    path: AbsolutePath;
    ignored: boolean;
});
type ImportIssue = Extract<ImportState, { stage: MediaIssueStatus }>;
export type MediaImportFailure = { name: string | null; path: AbsolutePath | null; error: Failure };

type TaskSource = ({
    kind: "import";
    source: InputSource;
} | {
    kind: "check";
    path: AbsolutePath;
} | {
    kind: "relink";
    previous: ImportIssue;
});
type ImportTask = { source: TaskSource; name: string; controller: AbortController; started: boolean };

const state = $state({
    items: [] as ImportState[],
    importFailures: [] as MediaImportFailure[],
    concurrency: 2,
    picking: false,
    collection: null as AbortController | null
});
const tasks = new SvelteMap<string, ImportTask>();
const issueDialogs = new SvelteMap<string, string>();
const failureDialogs = new SvelteMap<MediaImportFailure, string>();
let running = 0;

export function isIssue(item: ImportState): item is ImportIssue {
    return item.stage === "missing" || item.stage === "changed" || item.stage === "unreadable";
}

export function getIds(): string[] {
    return state.items.map(item => item.id);
}

export function get(id: string): ImportState | null {
    return state.items.find(item => item.id === id) ?? null;
}

export function getName(id: string): string {
    return project.getMedia(id)?.name ?? tasks.get(id)?.name ?? "";
}

export function rename(id: string, name: string): void {
    const task = tasks.get(id);
    if (task && task.source.kind === "import") task.name = name;
}

export function isReady(id: string): boolean {
    return get(id)?.stage === "ready";
}

export function getReadyIds(): string[] {
    return state.items.filter(item => item.stage === "ready").map(item => item.id);
}

export function getImportFailures(): MediaImportFailure[] {
    return state.importFailures;
}

export function getConcurrency(): number {
    return state.concurrency;
}

export function setConcurrency(value: number): void {
    if (!Number.isSafeInteger(value) || value < 1) throw new FailureError({ kind: "media-invalid-concurrency" });
    state.concurrency = value;
    pump();
}

export function isPicking(): boolean {
    return state.picking;
}

export function setPicking(value: boolean): void {
    state.picking = value;
}

export function isCollecting(): boolean {
    return state.collection !== null;
}

export function beginCollection(): AbortController | null {
    if (state.collection) return null;
    state.collection = new AbortController();
    return state.collection;
}

export function endCollection(controller: AbortController): void {
    if (state.collection === controller) state.collection = null;
}

export function hasPendingImports(): boolean {
    return isCollecting() || state.items.some(item => project.getMedia(item.id) === null);
}

export function getIssue(): ImportIssue | null {
    return state.items.find((item): item is ImportIssue => isIssue(item) && !item.ignored) ?? null;
}

export function isRelocating(): boolean {
    return state.items.some(item => item.stage === "relocating");
}

function update(item: ImportState): void {
    const index = state.items.findIndex(current => current.id === item.id);
    if (index >= 0) state.items[index] = item;
}

function closeIssue(id: string): void {
    const dialog = issueDialogs.get(id);
    if (dialog) dialogs.close(dialog);
    issueDialogs.delete(id);
}

function showIssue(id: string): void {
    const item = get(id);
    if (!item || !isIssue(item) || issueDialogs.has(id)) return;
    const dialog = dialogs.show({
        kind: "media-ref-import-error",
        issue: { status: item.stage, mediaId: id, path: item.path, error: item.error },
        onRetry: () => project.retryMedia(id), onRelink: () => project.relinkMedia(id), onIgnore: () => project.ignoreMedia(id),
        onClosed: () => {
            if (issueDialogs.get(id) === dialog) issueDialogs.delete(id);
        }
    });
    issueDialogs.set(id, dialog);
}

export function reset(ids: string[]): void {
    state.collection?.abort();
    state.collection = null;
    for (const task of tasks.values()) task.controller.abort();
    tasks.clear();
    for (const dialog of [...issueDialogs.values(), ...failureDialogs.values()]) dialogs.close(dialog);
    issueDialogs.clear();
    failureDialogs.clear();
    state.importFailures = [];
    state.items = ids.map(id => ({ id, stage: "queued" }));
    for (const id of ids) enqueue(id, { kind: "check", path: project.getMedia(id)!.path }, "");
    pump();
}

export function add(sources: InputSource[]): void {
    for (const source of sources) {
        const id = crypto.randomUUID();
        state.items.push({ id, stage: "queued" });
        enqueue(id, { kind: "import", source }, typeof source === "string" ? getFileName(source) : source.name);
    }
    pump();
}

export function retry(id: string): void {
    const item = get(id);
    if (!item || !isIssue(item)) return;
    enqueue(id, { kind: "check", path: item.path }, "");
    pump();
}

export function relink(id: string): void {
    const item = get(id);
    if (!item || !isIssue(item)) return;
    enqueue(id, { kind: "relink", previous: item }, "");
    pump();
}

export function ignore(id: string): void {
    const item = get(id);
    if (!item || !isIssue(item)) return;
    item.ignored = true;
    closeIssue(id);
}

export function review(id: string): void {
    const item = get(id);
    if (!item || !isIssue(item)) return;
    item.ignored = false;
    showIssue(id);
}

export function reportPlaybackFailure(id: string, status: MediaIssueStatus, error: Failure): void {
    const media = project.getMedia(id);
    if (media && isReady(id)) reportFailure(id, status, error, media.path);
}

export function remove(id: string): void {
    const task = tasks.get(id);
    tasks.delete(id);
    closeIssue(id);
    state.items = state.items.filter(item => item.id !== id);
    task?.controller.abort();
    pump();
}

export function reportImportFailure(input: MediaImportFailure): void {
    state.importFailures.push(input);
    const failure = state.importFailures[state.importFailures.length - 1];
    const dialog = dialogs.show({
        kind: "media-import-error", failure, onClosed: () => {
            const index = state.importFailures.indexOf(failure);
            if (index >= 0) state.importFailures.splice(index, 1);
            failureDialogs.delete(failure);
        }
    });
    failureDialogs.set(failure, dialog);
}

function reportFailure(id: string, status: MediaIssueStatus, error: Failure, path: AbsolutePath | null): void {
    const media = project.getMedia(id);
    if (media) {
        update({ id, stage: status, error, path: path ?? media.path, ignored: false });
        if (mediaSelection.get() === id) project.selectMedia(null);
        showIssue(id);
    }
    else {
        reportImportFailure({ name: getName(id), path, error });
        remove(id);
    }
}

function enqueue(id: string, source: TaskSource, name: string): void {
    closeIssue(id);
    update({ id, stage: "queued" });
    const task = $state<ImportTask>({ source, name, controller: new AbortController(), started: false });
    tasks.set(id, task);
}

function pump(): void {
    for (const [id, task] of tasks) {
        if (running >= state.concurrency) break;
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
            if (!result.success) throw new FailureError(result.error);
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
        if (expected) project.updateMediaPath(id, result.media.path);
        else {
            const ids = getIds();
            const index = ids.slice(0, ids.indexOf(id)).filter(id => project.getMedia(id) !== null).length;
            project.appendMedia({ ...result.media, id, name: task.name }, index);
        }
        update({ id, stage: "ready" });
        if (mediaSelection.get() === null) project.selectMedia(id);
    }
    catch (error) {
        if (tasks.get(id) !== task || task.controller.signal.aborted) return;
        reportFailure(id, "unreadable", toFailure(error), path);
        console.error(error);
    }
    finally {
        if (tasks.get(id) === task) tasks.delete(id);
        running--;
        pump();
    }
}