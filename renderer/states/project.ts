import { type FailureInfo, VestigeErrors, toFailureInfo } from "../../shared/failure";
import { type Project } from "../../shared/project/Project";
import { type Media } from "../../shared/Media";
import { type Modification } from "../../shared/Vestige";
import { type Run } from "../../shared/transcription/Run";
import { type InputSource } from "../../shared/util/file";
import { type AbsolutePath } from "../../shared/util/path";
import { projectVersion, autosaveInterval } from "../../shared/project/constants";
import * as player from "./player.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as transcription from "./transcription.svelte";
import * as dialogs from "./dialogs.svelte";
import * as settings from "./settings.svelte";
import * as project from "./project.svelte";
import * as dialogsAPI from "./dialogs";
import * as playerAPI from "./player";
import * as transcriptionAPI from "./transcription";
import * as mediaImportAPI from "./mediaImport";

let confirmation: Promise<dialogs.SaveChoice> | null = null;
let busy: { id: string; operation: project.ProjectOperation } | null = null;
let savedText = "";
let saveTask: Promise<boolean> | null = null;
let activeTransition: Promise<boolean> | null = null;
let autosaveTimer: ReturnType<typeof setInterval> | null = null;
let lifecycleStarted = false;
let projectGeneration = 0;
let resumeAfterLeave: (() => void) | null = null;

function confirmSave(fileName: string | null, error: FailureInfo | null = null): Promise<dialogs.SaveChoice> {
    if (confirmation) return confirmation;
    setOperation(null);
    project.saveConfirmation.pending = true;
    project.saveConfirmation.fileName = fileName;
    project.saveConfirmation.error = error;
    confirmation = new Promise(resolve => {
        let answer: dialogs.SaveChoice = "cancel";
        const callbacks = {
            fileName,
            answer: (choice: dialogs.SaveChoice) => {
                answer = choice;
                dialogsAPI.close(id);
            },
            onClosed: () => {
                confirmation = null;
                project.saveConfirmation.pending = false;
                project.saveConfirmation.fileName = null;
                project.saveConfirmation.error = null;
                resolve(answer);
            }
        };
        const id = dialogsAPI.show(error === null ? { kind: "save-confirmation", ...callbacks }
            : { kind: "save-failure", error, ...callbacks });
    });
    return confirmation;
}

function reportError(error: project.ProjectError): void {
    project.projectState.error = error;
    const current = project.projectState.error;
    dialogsAPI.show({
        kind: "project-error", error: current, onClosed: () => {
            if (project.projectState.error === current) project.projectState.error = null;
        }
    });
}

function reportUnexpected(error: unknown): void {
    console.error(error);
    reportError({ kind: "operation-failed", failure: toFailureInfo(error) });
}

function rejectPendingImports(): boolean {
    if (!mediaImport.hasPendingImports()) return false;
    reportError({ kind: "pending-imports" });
    return true;
}

function rejectActiveTranscriptions(): boolean {
    if (!transcription.hasPending()) return false;
    reportError({ kind: "active-transcriptions" });
    return true;
}

function setOperation(operation: project.ProjectOperation | null): void {
    project.projectState.operation = operation;
    if (operation === null) {
        if (busy) dialogsAPI.close(busy.id);
        busy = null;
        return;
    }
    if (busy) {
        busy.operation = operation;
        return;
    }
    const current = project.createBusyState(operation);
    current.id = dialogsAPI.show({
        kind: "project-busy",
        getOperation: () => current.operation,
        onClosed: () => {}
    });
    busy = current;
}

function invokeWithLock(action: () => Promise<boolean>): Promise<boolean> {
    if (project.projectState.locked || rejectPendingImports()) return Promise.resolve(false);
    // Confirmation holds the lock, but progress starts only when work begins.
    project.projectState.locked = true;
    let completed = false;
    activeTransition = Promise.resolve().then(async () => {
        while (saveTask) {
            setOperation({ kind: "wait-save", fileName: project.getFileName() });
            if (!await saveTask) return false;
        }
        completed = await action();
        return completed;
    }).catch(error => {
        reportUnexpected(error);
        return false;
    }).finally(() => {
        if (!completed) resumeAfterLeave?.();
        resumeAfterLeave = null;
        project.projectState.locked = false;
        setOperation(null);
        activeTransition = null;
    });
    return activeTransition;
}

function pauseAutosave(): void {
    if (autosaveTimer !== null) clearInterval(autosaveTimer);
    autosaveTimer = null;
}

function resumeAutosave(): void {
    if (!lifecycleStarted || autosaveTimer !== null || project.projectState.path === null) return;
    autosaveTimer = setInterval(() => {
        if (project.projectState.path === null || project.projectState.locked || project.projectState.saving || project.projectState.error !== null || mediaImport.hasPendingImports()) return;
        void saveCurrent();
    }, autosaveInterval);
}

function createProject(): Project {
    return { version: projectVersion, lastOpened: Date.now(), vestiges: [] };
}

function hasChanges(): boolean {
    return mediaImport.hasPendingImports() || (project.projectState.project !== null && (project.projectState.path === null || JSON.stringify(project.projectState.project) !== savedText));
}

async function writeCurrent(saveAs: boolean): Promise<boolean> {
    if (rejectPendingImports()) return false;
    const currentProject = project.projectState.project;
    if (!currentProject) return false;
    project.projectState.saving = true;
    let recoveryLock = false;
    let path = project.projectState.path;
    let lastError: FailureInfo | null = null;
    try {
        for (; ;) {
            if (rejectPendingImports()) return false;
            let failure = lastError;
            try {
                if (project.projectState.locked) setOperation({ kind: "save", path, saveAs });
                let cancelled = false;
                if (saveAs || path === null) {
                    const selected = await window.api.project.selectSavePath(path, saveAs);
                    if (selected === null) cancelled = true;
                    else path = selected;
                }
                if (cancelled && lastError === null) return false;
                if (!cancelled && path !== null) {
                    if (project.projectState.locked) setOperation({ kind: "save", path, saveAs: false });
                    playerAPI.captureProgress();
                    if (!settings.getPlayback().rememberPlaybackPosition) {
                        for (const vestige of currentProject.vestiges) vestige.playbackPosition = 0;
                    }
                    const snapshot = project.snapshotProject(currentProject);
                    const text = JSON.stringify(snapshot);
                    // Recreate deleted project files, even when the snapshot is unchanged.
                    const result = await window.api.project.saveProject(path, snapshot);
                    if (result.success) {
                        if (project.projectState.project === currentProject) {
                            project.projectState.path = path;
                            savedText = text;
                            resumeAutosave();
                        }
                        return true;
                    }
                    failure = result.error;
                }
            }
            catch (error) {
                console.error(error);
                failure = toFailureInfo(error);
            }
            pauseAutosave();
            lastError = failure!;
            if (!project.projectState.locked) {
                project.projectState.locked = true;
                recoveryLock = true;
            }
            const choice = await confirmSave(path ?? project.getFileName(), lastError);
            if (choice === "retry") {
                saveAs = false;
                continue;
            }
            if (choice === "save") {
                saveAs = true;
                continue;
            }
            if (choice === "memory") {
                project.projectState.path = null;
                savedText = "";
            }
            return false;
        }
    }
    finally {
        project.projectState.saving = false;
        if (recoveryLock) {
            project.projectState.locked = false;
            setOperation(null);
        }
    }
}

async function saveCurrent(saveAs = false): Promise<boolean> {
    while (saveTask) {
        if (project.projectState.locked) setOperation({ kind: "wait-save", fileName: project.getFileName() });
        if (!await saveTask) return false;
    }
    saveTask = writeCurrent(saveAs).finally(() => {
        saveTask = null;
    });
    return saveTask;
}

async function prepareToLeave(): Promise<boolean> {
    if (rejectPendingImports() || rejectActiveTranscriptions()) return false;
    while (saveTask) {
        if (project.projectState.locked) setOperation({ kind: "wait-save", fileName: project.getFileName() });
        if (!await saveTask) return false;
    }
    if (!project.projectState.project) return true;
    resumeAfterLeave ??= playerAPI.pauseForProjectChange();
    if (project.projectState.path === null) {
        const choice = await confirmSave(project.getFileName());
        if (choice === "cancel") return false;
        if (choice === "discard") return true;
    }
    if (!await saveCurrent()) return false;
    // Flush edits or completed Runs that arrived during the preceding write.
    while (hasChanges()) if (!await saveCurrent()) return false;
    return true;
}

async function replaceProject(nextProject: Project | null, path: AbsolutePath | null): Promise<void> {
    mediaSelection.select(null);
    transcriptionAPI.stopAll();
    projectGeneration++;
    mediaImportAPI.reset([]);
    const released = playerAPI.reset();
    project.projectState.path = path;
    project.projectState.project = nextProject;
    await released;
    mediaImportAPI.reset(nextProject?.vestiges.map(vestige => vestige.media.id) ?? []);
}

export function create(): Promise<boolean> {
    return invokeWithLock(async () => {
        if (!await prepareToLeave()) return false;
        setOperation({ kind: "new" });
        await replaceProject(createProject(), null);
        savedText = "";
        pauseAutosave();
        return true;
    });
}

// Both entry points hold the project lock before resolving or reading the source.
async function openSource(source: InputSource): Promise<boolean> {
    setOperation({ kind: "open", path: typeof source === "string" ? source : null });
    const resolved = typeof source === "string" ? { success: true as const, path: source } : await window.api.file.getPathForFile(source);
    if (!resolved.success) throw new VestigeErrors(resolved.error);
    const path = resolved.path;
    setOperation({ kind: "read", path });
    const result = await window.api.project.getProject(path);
    if (!result.success) {
        reportError({ kind: "read-failed", path, failure: result.error });
        return false;
    }
    if (!await prepareToLeave()) return false;
    setOperation({ kind: "open", path });
    savedText = JSON.stringify(result.project);
    result.project.lastOpened = Date.now();
    await replaceProject(result.project, path);
    resumeAutosave();
    return true;
}

export function open(): Promise<boolean> {
    return invokeWithLock(async () => {
        setOperation({ kind: "open", path: null });
        const source = await window.api.project.selectOpenPath();
        return source === null ? false : openSource(source);
    });
}

export function openFile(source: InputSource): Promise<boolean> {
    return invokeWithLock(() => openSource(source));
}

export function save(saveAs = false): Promise<boolean> {
    return invokeWithLock(() => saveCurrent(saveAs));
}

export function appendMedia(mediaFile: Media, index: number): void {
    if (!mediaImport.get(mediaFile.id) || project.getMedia(mediaFile.id)) throw new VestigeErrors({ kind: "media-invalid-import" });
    project.projectState.project ??= createProject();
    project.projectState.project.vestiges.splice(index, 0, { media: mediaFile, playbackPosition: 0, runs: [], displayedRunIdx: 0, modifications: [] });
}

export function updateMediaPath(id: string, path: AbsolutePath): void {
    if (mediaSelection.get() === id) {
        playerAPI.commitSeekPreview();
        playerAPI.captureProgress();
    }
    const media = project.getMedia(id);
    if (media) media.path = path;
    if (mediaSelection.get() === id) void playerAPI.synchronize().catch(reportUnexpected);
}

export function appendRun(id: string, run: Run): void {
    project.getVestige(id)?.runs.push(run);
}

export function removeRun(id: string, runId: string): void {
    const vestige = project.getVestige(id);
    if (project.projectState.locked || !vestige) return;
    const index = vestige.runs.findIndex(run => run.id === runId);
    if (index < 0) return;
    const displayed = vestige.displayedRunIdx;
    vestige.runs.splice(index, 1);
    if (index === displayed) {
        vestige.modifications = [];
        vestige.displayedRunIdx = Math.max(0, Math.min(index, vestige.runs.length - 1));
    }
    else if (index < displayed) vestige.displayedRunIdx--;
}

export function updateModifications(id: string, runId: string, modifications: readonly Modification[]): void {
    const vestige = project.getVestige(id);
    if (project.projectState.locked || !vestige || vestige.runs[vestige.displayedRunIdx]?.id !== runId) return;
    // Editor history owns immutable snapshots; project state must not mutate those objects.
    vestige.modifications = structuredClone([...modifications]);
}

export function displayRun(id: string, index: number): void {
    const vestige = project.getVestige(id);
    if (project.projectState.locked || !vestige || !Number.isSafeInteger(index) || !vestige.runs[index] || index === vestige.displayedRunIdx) return;
    const run = vestige.runs[index];
    const apply = (): void => {
        if (project.projectState.locked || project.getVestige(id) !== vestige || vestige.runs[index] !== run) return;
        vestige.modifications = [];
        vestige.displayedRunIdx = index;
    };
    if (!vestige.modifications.length) apply();
    else if (!dialogs.state.dialogs.some(dialog => dialog.kind === "switch-displayed-run" && dialog.mediaId === id)) {
        dialogsAPI.show({ kind: "switch-displayed-run", mediaId: id, onConfirm: apply, onClosed: () => {} });
    }
}

export function importMedia(sources: InputSource[]): boolean {
    if (project.projectState.locked || !sources.length) return false;
    mediaImportAPI.add(sources);
    return true;
}

export async function selectMediaForImport(): Promise<void> {
    if (project.projectState.locked || mediaImport.isPicking()) return;
    const generation = projectGeneration;
    mediaImportAPI.setPicking(true);
    try {
        const paths = await window.api.file.selectMediaPaths();
        if (generation === projectGeneration) importMedia(paths);
    }
    catch (error) {
        if (generation === projectGeneration) reportUnexpected(error);
    }
    finally {
        mediaImportAPI.setPicking(false);
    }
}

export function selectMedia(id: string | null): void {
    const previous = mediaSelection.get();
    if (previous === id || (id !== null && !mediaImport.isReady(id))) return;
    playerAPI.commitSeekPreview();
    playerAPI.captureProgress();
    if (!mediaSelection.select(id)) return;
    void (previous !== null && id !== null ? playerAPI.switchMedia() : playerAPI.synchronize()).catch(reportUnexpected);
}

export function restorePlayback(): void {
    const position = settings.getPlayback().rememberPlaybackPosition ? project.getVestige(mediaSelection.get())?.playbackPosition ?? 0 : 0;
    playerAPI.updatePlaybackTime(position, "commit");
}

export function seekPlayback(time: number, mode: player.SeekMode = "commit"): void {
    const vestige = project.getVestige(mediaSelection.get());
    if (!vestige || !player.getURL() || !Number.isFinite(time)) return;
    const position = Math.max(0, Math.min(vestige.media.duration, time));
    if (mode === "commit") vestige.playbackPosition = settings.getPlayback().rememberPlaybackPosition ? position : 0;
    // Transcript highlights derive from the same time, including explicit seeks.
    playerAPI.updatePlaybackTime(position, mode);
}

export function observePlaybackTime(id: string, time: number, remember = false): void {
    const vestige = project.getVestige(id);
    if (mediaSelection.get() !== id || !vestige || !player.getURL() || !Number.isFinite(time)) return;
    const position = Math.max(0, Math.min(vestige.media.duration, time));
    if (remember) vestige.playbackPosition = settings.getPlayback().rememberPlaybackPosition ? position : 0;
    playerAPI.updatePlaybackTime(position, null);
}

export function renameMedia(id: string, name: string): void {
    const trimmed = name.trim();
    if (project.projectState.locked || !trimmed) return;
    const media = project.getMedia(id);
    if (media) media.name = trimmed;
    else mediaImportAPI.rename(id, trimmed);
}

export function removeMedia(id: string): void {
    if (project.projectState.locked) return;
    transcriptionAPI.stop(id);
    for (const dialog of dialogs.state.dialogs) if ("mediaId" in dialog && dialog.mediaId === id) dialogsAPI.close(dialog.id);
    const next = mediaSelection.get() === id ? mediaSelection.adjacent(1) ?? mediaSelection.adjacent(-1) : mediaSelection.get();
    if (project.projectState.project) {
        const index = project.projectState.project.vestiges.findIndex(vestige => vestige.media.id === id);
        if (index >= 0) project.projectState.project.vestiges.splice(index, 1);
    }
    mediaImportAPI.remove(id);
    selectMedia(next);
}

export function moveMedia(id: string, beforeId: string | null): void {
    if (project.projectState.locked || !mediaImportAPI.move(id, beforeId)) return;
    const vestiges = project.projectState.project?.vestiges;
    const from = vestiges?.findIndex(vestige => vestige.media.id === id) ?? -1;
    if (!vestiges || from < 0) return;
    const ids = mediaImport.getIds();
    // Pending imports occupy list positions but are inserted into the project only when ready.
    const to = ids.slice(0, ids.indexOf(id)).filter(mediaId => project.getMedia(mediaId) !== null).length;
    const [vestige] = vestiges.splice(from, 1);
    vestiges.splice(to, 0, vestige);
}

export function retryMedia(id: string): void {
    if (!project.projectState.locked) mediaImportAPI.retry(id);
}

export function relinkMedia(id: string): void {
    if (!project.projectState.locked) mediaImportAPI.relink(id);
}

export function ignoreMedia(id: string): void {
    if (!project.projectState.locked) mediaImportAPI.ignore(id);
}

export function reviewMedia(id: string): void {
    if (!project.projectState.locked) mediaImportAPI.review(id);
}

export function close(): Promise<boolean> {
    return invokeWithLock(async () => {
        if (!await prepareToLeave()) return false;
        setOperation({ kind: "close" });
        await replaceProject(null, null);
        savedText = "";
        pauseAutosave();
        return true;
    });
}

export function startLifecycle(saveSettingsBeforeQuit: () => Promise<boolean>): () => void {
    lifecycleStarted = true;
    mediaImportAPI.reset(project.projectState.project?.vestiges.map(vestige => vestige.media.id) ?? []);
    let checking: Promise<boolean> | null = null;
    const unsubscribe = window.api.beforeQuit(() => {
        if (rejectPendingImports() || rejectActiveTranscriptions()) return Promise.resolve(true);
        checking ??= (async () => {
            while (activeTransition) if (!await activeTransition) return true;
            while (saveTask) if (!await saveTask) return true;
            return !await invokeWithLock(async () => {
                if (!await prepareToLeave()) return false;
                setOperation({ kind: "quit" });
                return saveSettingsBeforeQuit();
            });
        })().finally(() => {
            checking = null;
        });
        return checking;
    });
    const beforeUnload = (event: BeforeUnloadEvent): void => {
        if (hasChanges() || project.projectState.locked || transcription.hasPending()) {
            event.preventDefault();
            event.returnValue = false;
        }
    };
    resumeAutosave();
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
        lifecycleStarted = false;
        projectGeneration++;
        transcriptionAPI.stopAll();
        mediaImportAPI.reset([]);
        mediaSelection.select(null);
        void playerAPI.reset().catch(reportUnexpected);
        pauseAutosave();
        unsubscribe();
        window.removeEventListener("beforeunload", beforeUnload);
    };
}