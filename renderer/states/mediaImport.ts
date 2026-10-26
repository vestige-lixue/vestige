import { validationInitialConcurrency, validationSampleMs } from "../../shared/media/validation";
import { MediaValidationConcurrency } from "./mediaValidation";
import * as playerAPI from "./player";
import { TaskQueue, type ScheduledTask } from "./taskQueue";
import { type FailureInfo, VestigeErrors, toFailureInfo } from "../../shared/failure";
import { type MediaIssueStatus } from "../../shared/media/check";
import { type InputSource } from "../../shared/util/file";
import { getFileName, type AbsolutePath } from "../../shared/util/path";
import { isProjectFile } from "../../shared/project/file";
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

let validation = new MediaValidationConcurrency(navigator.hardwareConcurrency || validationInitialConcurrency);
let playing = false;
let validationReady = false;
let validationEpoch = 0;
let samplingEpoch: number | null = null;
let validationTimer: ReturnType<typeof setInterval> | null = null;
let prioritized: string | null = null;
let suspension: AbortController | null = null;

const tasks = new TaskQueue<TaskSource>({
    concurrency: 0,
    run: task => run(task.id, task),
    settled: (task, current) => {
        if (current) mediaImport.names.delete(task.id);
    }
});
const issueDialogs = new Map<string, string>();
const failureDialogs = new Map<mediaImport.MediaImportFailure, string>();
let collection: AbortController | null = null;

function updateConcurrency(): void {
    tasks.setConcurrency(!suspension && validationReady ? validation.getConcurrency() : 0);
}

export function pauseForQuit(): () => void {
    const current = new AbortController();
    suspension = current;
    updateConcurrency();
    return () => {
        if (suspension !== current) return;
        suspension = null;
        current.abort();
        updateConcurrency();
    };
}

export async function waitForResume(signal: AbortSignal): Promise<void> {
    while (suspension && !signal.aborted) {
        const resumed = AbortSignal.any([suspension.signal, signal]);
        if (!resumed.aborted) await new Promise<void>(resolve => resumed.addEventListener("abort", () => resolve(), { once: true }));
    }
}

function resetValidation(): void {
    validationEpoch++;
    if (validationTimer !== null) clearInterval(validationTimer);
    validationTimer = null;
    validation = new MediaValidationConcurrency(navigator.hardwareConcurrency || validationInitialConcurrency);
    validation.setPlaying(playing);
    validationReady = false;
    tasks.setConcurrency(0);
    prioritized = null;
}

function monitorValidation(): void {
    if (validationTimer !== null) return;
    const epoch = validationEpoch;
    const sample = async (): Promise<void> => {
        if (epoch !== validationEpoch || samplingEpoch === epoch) return;
        if (!tasks.hasPending()) {
            if (validationTimer !== null) clearInterval(validationTimer);
            validationTimer = null;
            return;
        }
        samplingEpoch = epoch;
        const started = performance.now();
        try {
            const load = await window.api.file.validationLoad();
            if (epoch !== validationEpoch) return;
            const roundTripMs = performance.now() - started;
            const previous = validation.getConcurrency();
            validation.observe(load, roundTripMs);
            validationReady = true;
            updateConcurrency();
            if (previous !== validation.getConcurrency()) console.debug("Media validation concurrency", {
                concurrency: validation.getConcurrency(), bytesPerSecond: validation.getBytesPerSecond(),
                eventLoopDelayMs: load.eventLoopDelayMs, roundTripMs
            });
        }
        catch (error) {
            if (epoch === validationEpoch) console.error("Could not sample media validation load:", error);
        }
        finally {
            if (samplingEpoch === epoch) samplingEpoch = null;
        }
    };
    validationTimer = setInterval(() => void sample(), validationSampleMs);
    void sample();
}

export function updateValidationPlayback(value: boolean): void {
    if (playing === value) return;
    playing = value;
    validation.setPlaying(value);
    updateConcurrency();
    window.api.file.validationPlayback(value);
}

export function prioritize(id: string | null): void {
    if (prioritized !== null) tasks.setPriority(prioritized, 0);
    prioritized = id;
    if (id !== null) tasks.setPriority(id, 1);
}

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
    if (mediaImport.items.has(item.id)) mediaImport.items.set(item.id, mediaImport.createItem(item));
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
    suspension?.abort();
    suspension = null;
    resetValidation();
    mediaImport.names.clear();
    for (const dialog of [...issueDialogs.values(), ...failureDialogs.values()]) dialogsAPI.close(dialog);
    issueDialogs.clear();
    failureDialogs.clear();
    mediaImport.state.importFailures = [];
    mediaImport.items.clear();
    for (const id of ids) mediaImport.items.set(id, mediaImport.createItem({ id, stage: "queued" }));
    mediaImport.state.ids = [...ids];
    for (const id of ids) enqueue(id, { kind: "check", path: project.getMedia(id)!.path }, "");
}

export function add(sources: InputSource[]): void {
    for (const source of sources) {
        const id = crypto.randomUUID();
        project.prepareVestige(id);
        mediaImport.items.set(id, mediaImport.createItem({ id, stage: "queued" }));
        mediaImport.state.ids.push(id);
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
    mediaImport.items.delete(id);
    mediaImport.state.ids = mediaImport.state.ids.filter(current => current !== id);
}

export async function cancelPending(): Promise<void> {
    collection?.abort();
    collection = null;
    mediaImport.state.collecting = false;
    const remaining: string[] = [];
    const completions: Promise<void>[] = [];
    // Suspend dispatch and replace the order once, rather than rescan it for every removal.
    tasks.setConcurrency(0);
    for (const id of mediaImport.getIds()) {
        if (project.getMedia(id)) {
            remaining.push(id);
            continue;
        }
        const task = tasks.get(id);
        if (task) completions.push(task.completed);
        tasks.cancel(id);
        mediaImport.names.delete(id);
        closeIssue(id);
        mediaImport.items.delete(id);
    }
    mediaImport.state.ids = remaining;
    if (prioritized !== null && !mediaImport.items.has(prioritized)) prioritized = null;
    updateConcurrency();
    // A cancelled read resolves only after main has closed its file and native process.
    await Promise.all(completions);
}

export function move(id: string, beforeId: string | null): boolean {
    const ids = mediaImport.state.ids;
    const from = ids.indexOf(id);
    const before = beforeId === null ? ids.length : ids.indexOf(beforeId);
    if (from < 0 || before < 0 || from === before || from + 1 === before) return false;
    ids.splice(from, 1);
    ids.splice(before > from ? before - 1 : before, 0, id);
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
        if (mediaSelection.get() === id) void playerAPI.synchronize().catch(console.error);
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
    if (prioritized === id) tasks.setPriority(id, 1);
    mediaImport.names.set(id, name);
    monitorValidation();
}

async function run(id: string, task: ImportTask): Promise<void> {
    let path: AbsolutePath | null = null;
    try {
        await waitForResume(task.signal);
        if (!tasks.isCurrent(task)) return;
        let source: InputSource;
        if (task.value.kind === "relink") {
            update({ id, stage: "relocating" });
            const selected = await window.api.file.selectMediaPath(task.value.previous.path);
            await waitForResume(task.signal);
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
        await waitForResume(task.signal);
        if (!tasks.isCurrent(task)) return;
        if (task.value.kind === "import" && isProjectFile(path)) {
            reportFailure(id, "unreadable", { kind: "media-format" }, path);
            return;
        }
        update({ id, stage: "reading" });
        const requestId = crypto.randomUUID();
        const cancel = (): void => window.api.file.cancelMediaRead(requestId);
        task.signal.addEventListener("abort", cancel, { once: true });
        const expected = project.getMedia(id);
        const reference = expected ? { path: expected.path, size: expected.size, hash: expected.hash } : null;
        const result = await window.api.file.readMedia(requestId, path, expected ? { size: expected.size, hash: expected.hash } : null)
            .finally(() => task.signal.removeEventListener("abort", cancel));
        // Hold results while saving for quit; a cancelled quit can apply them normally.
        await waitForResume(task.signal);
        if (!tasks.isCurrent(task)) return;
        if (expected && (project.getMedia(id) !== expected || expected.path !== reference!.path || expected.size !== reference!.size || expected.hash !== reference!.hash)) {
            const current = project.getMedia(id);
            if (current) enqueue(id, { kind: "check", path: current.path }, "");
            return;
        }
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
        if (mediaSelection.get() === id) void playerAPI.synchronize(false).catch(console.error);
        else if (mediaSelection.get() === null) projectAPI.selectMedia(id);
    }
    catch (error) {
        await waitForResume(task.signal);
        if (!tasks.isCurrent(task) || task.signal.aborted) return;
        reportFailure(id, "unreadable", toFailureInfo(error), path);
        console.error(error);
    }
}