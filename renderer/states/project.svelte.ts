import { type Project } from "../../shared/project/Project";
import { type Media } from "../../shared/Media";
import { type Vestige } from "../../shared/Vestige";
import { type Run } from "../../shared/transcription/Run";
import { type InputSource } from "../../shared/util/file";
import { getFileName as getPathFileName, type AbsolutePath } from "../../shared/util/path";
import { projectVersion, autosaveInterval } from "../../shared/project/constants";
import * as player from "./player.svelte";
import * as mediaImport from "./mediaImport.svelte";
import * as mediaSelection from "./mediaSelection.svelte";
import * as transcription from "./transcription.svelte";
import * as dialogs from "./dialogs.svelte";

export type ProjectState = {
    path: AbsolutePath | null;
    project: Project | null;
    locked: boolean;
    operation: dialogs.ProjectOperation | null;
    saving: boolean;
    error: dialogs.ProjectError | null;
};

export const projectState = $state<ProjectState>({
    path: null, project: null, locked: false, operation: null, saving: false, error: null
});

export const saveConfirmation = $state<{ fileName: string | null; error: string | null }>({ fileName: null, error: null });

let confirmation: Promise<dialogs.SaveChoice> | null = null;
let savedText = "";
let saveTask: Promise<boolean> | null = null;
let activeTransition: Promise<boolean> | null = null;
let autosaveTimer: ReturnType<typeof setInterval> | null = null;
let lifecycleStarted = false;
let projectGeneration = 0;

export function getFileName(): string {
    return projectState.project ? projectState.path === null ? "<未保存>" : getPathFileName(projectState.path) : "";
}

function confirmSave(fileName: string, error: string | null = null): Promise<dialogs.SaveChoice> {
    if (confirmation) return confirmation;
    saveConfirmation.fileName = fileName;
    saveConfirmation.error = error;
    confirmation = new Promise(resolve => {
        let answer: dialogs.SaveChoice = "cancel";
        const callbacks = {
            fileName,
            answer: (choice: dialogs.SaveChoice) => {
                answer = choice;
                dialogs.close(id);
            },
            onClosed: () => {
                confirmation = null;
                saveConfirmation.fileName = null;
                saveConfirmation.error = null;
                resolve(answer);
            }
        };
        const id = dialogs.show(error === null ? { kind: "save-confirmation", ...callbacks }
            : { kind: "save-failure", error, ...callbacks });
    });
    return confirmation;
}

function reportError(error: dialogs.ProjectError): void {
    projectState.error = error;
    const current = projectState.error;
    dialogs.show({
        kind: "project-error", error: current, onClosed: () => {
            if (projectState.error === current) projectState.error = null;
        }
    });
}

function reportUnexpected(error: unknown): void {
    console.error(error);
    reportError({ kind: "operation-failed", diagnostic: error instanceof Error ? error.message : String(error) });
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

function showBusy(operation: dialogs.ProjectOperation): string {
    return dialogs.show({
        kind: "project-busy",
        getOperation: () => projectState.operation ?? operation,
        onClosed: () => {}
    });
}

function invokeWithLock(operation: dialogs.ProjectOperation, action: () => Promise<boolean>): Promise<boolean> {
    if (projectState.locked || rejectPendingImports()) return Promise.resolve(false);
    projectState.locked = true;
    projectState.operation = operation;
    const busy = showBusy(operation);
    activeTransition = Promise.resolve().then(async () => {
        while (saveTask) {
            projectState.operation = { kind: "wait-save", fileName: getFileName() };
            if (!await saveTask) return false;
        }
        projectState.operation = operation;
        return action();
    }).catch(error => {
        reportUnexpected(error);
        return false;
    }).finally(() => {
        projectState.locked = false;
        projectState.operation = null;
        activeTransition = null;
        dialogs.close(busy);
    });
    return activeTransition;
}

function pauseAutosave(): void {
    if (autosaveTimer !== null) clearInterval(autosaveTimer);
    autosaveTimer = null;
}

function resumeAutosave(): void {
    if (!lifecycleStarted || autosaveTimer !== null || projectState.path === null) return;
    autosaveTimer = setInterval(() => {
        if (projectState.path === null || projectState.locked || projectState.saving || projectState.error !== null || mediaImport.hasPendingImports()) return;
        void saveCurrent();
    }, autosaveInterval);
}

function createProject(): Project {
    return { version: projectVersion, lastOpened: Date.now(), vestiges: [] };
}

function hasChanges(): boolean {
    return mediaImport.hasPendingImports() || (projectState.project !== null && (projectState.path === null || JSON.stringify(projectState.project) !== savedText));
}

async function writeCurrent(saveAs: boolean): Promise<boolean> {
    if (rejectPendingImports()) return false;
    const project = projectState.project;
    if (!project) return false;
    projectState.saving = true;
    const previousOperation = projectState.operation;
    let recoveryLock = false;
    let recoveryBusy: string | null = null;
    let path = projectState.path;
    let lastError: string | null = null;
    try {
        for (; ;) {
            if (rejectPendingImports()) return false;
            let message = lastError;
            try {
                if (projectState.locked) projectState.operation = { kind: "save", path, saveAs };
                let cancelled = false;
                if (saveAs || path === null) {
                    const selected = await window.api.project.selectSavePath(path);
                    if (selected === null) cancelled = true;
                    else path = selected;
                }
                if (cancelled && lastError === null) return false;
                if (!cancelled && path !== null) {
                    if (projectState.locked) projectState.operation = { kind: "save", path, saveAs: false };
                    const snapshot = $state.snapshot(project);
                    const text = JSON.stringify(snapshot);
                    // Recreate deleted project files, even when the snapshot is unchanged.
                    const result = await window.api.project.saveProject(path, snapshot);
                    if (result.success) {
                        if (projectState.project === project) {
                            projectState.path = path;
                            savedText = text;
                            resumeAutosave();
                        }
                        return true;
                    }
                    message = result.error;
                }
            }
            catch (error) {
                console.error(error);
                message = error instanceof Error ? error.message : String(error);
            }
            pauseAutosave();
            lastError = message!;
            if (!projectState.locked) {
                projectState.locked = true;
                recoveryLock = true;
                projectState.operation = { kind: "save", path, saveAs };
                recoveryBusy = showBusy(projectState.operation);
            }
            const choice = await confirmSave(path ?? getFileName(), lastError);
            if (choice === "retry") {
                saveAs = false;
                continue;
            }
            if (choice === "save") {
                saveAs = true;
                continue;
            }
            if (choice === "memory") {
                projectState.path = null;
                savedText = "";
            }
            return false;
        }
    }
    finally {
        projectState.saving = false;
        if (recoveryLock) projectState.locked = false;
        if (recoveryBusy) dialogs.close(recoveryBusy);
        projectState.operation = previousOperation;
    }
}

async function saveCurrent(saveAs = false): Promise<boolean> {
    while (saveTask) {
        if (projectState.locked) projectState.operation = { kind: "wait-save", fileName: getFileName() };
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
        if (projectState.locked) projectState.operation = { kind: "wait-save", fileName: getFileName() };
        if (!await saveTask) return false;
    }
    if (!projectState.project) return true;
    if (projectState.path === null) {
        const choice = await confirmSave(getFileName());
        if (choice === "cancel") return false;
        if (choice === "discard") return true;
    }
    if (!await saveCurrent()) return false;
    // Flush edits or completed Runs that arrived during the preceding write.
    while (hasChanges()) if (!await saveCurrent()) return false;
    return true;
}

async function replaceProject(project: Project | null, path: AbsolutePath | null): Promise<void> {
    mediaSelection.select(null);
    transcription.clear();
    projectGeneration++;
    mediaImport.reset([]);
    const released = player.reset();
    projectState.path = path;
    projectState.project = project;
    await released;
    mediaImport.reset(project?.vestiges.map(vestige => vestige.media.id) ?? []);
}

export function create(): Promise<boolean> {
    return invokeWithLock({ kind: "new" }, async () => {
        if (!await prepareToLeave()) return false;
        await replaceProject(createProject(), null);
        savedText = "";
        pauseAutosave();
        return true;
    });
}

// Both entry points hold the project lock before resolving or reading the source.
async function openSource(source: InputSource): Promise<boolean> {
    const path = typeof source === "string" ? source : await window.api.file.getPathForFile(source);
    projectState.operation = { kind: "read", path };
    const result = await window.api.project.getProject(path);
    if (!result.success) {
        reportError({ kind: "read-failed", path, diagnostic: result.error });
        return false;
    }
    if (!await prepareToLeave()) return false;
    savedText = JSON.stringify(result.project);
    result.project.lastOpened = Date.now();
    await replaceProject(result.project, path);
    resumeAutosave();
    return true;
}

export function open(): Promise<boolean> {
    return invokeWithLock({ kind: "open", path: null }, async () => {
        const source = await window.api.project.selectOpenPath();
        return source === null ? false : openSource(source);
    });
}

export function openFile(source: InputSource): Promise<boolean> {
    return invokeWithLock({ kind: "open", path: typeof source === "string" ? source : null }, () => openSource(source));
}

export function save(saveAs = false): Promise<boolean> {
    return invokeWithLock({ kind: "save", path: projectState.path, saveAs }, () => saveCurrent(saveAs));
}

export function getVestige(id: string | null): Vestige | null {
    return projectState.project?.vestiges.find(vestige => vestige.media.id === id) ?? null;
}

export function getMedia(id: string | null): Media | null {
    return getVestige(id)?.media ?? null;
}

export function appendMedia(mediaFile: Media, index: number): void {
    if (!mediaImport.get(mediaFile.id) || getMedia(mediaFile.id)) throw new Error("A pending, unique media import is required.");
    projectState.project ??= createProject();
    projectState.project.vestiges.splice(index, 0, { media: mediaFile, runs: [], primaryRunIdx: 0, modifications: [] });
}

export function updateMediaPath(id: string, path: AbsolutePath): void {
    const media = getMedia(id);
    if (media) media.path = path;
    if (mediaSelection.get() === id) void player.synchronize().catch(reportUnexpected);
}

export function appendRun(id: string, run: Run): void {
    getVestige(id)?.runs.push(run);
}

export function importMedia(sources: InputSource[]): boolean {
    if (projectState.locked || !sources.length) return false;
    mediaImport.add(sources);
    return true;
}

export async function selectMediaForImport(): Promise<void> {
    if (projectState.locked || mediaImport.isPicking()) return;
    const generation = projectGeneration;
    mediaImport.setPicking(true);
    try {
        const paths = await window.api.file.selectMediaPaths();
        if (generation === projectGeneration) importMedia(paths);
    }
    catch (error) {
        if (generation === projectGeneration) reportUnexpected(error);
    }
    finally {
        mediaImport.setPicking(false);
    }
}

export function selectMedia(id: string | null): void {
    if (mediaSelection.select(id)) void player.synchronize().catch(reportUnexpected);
}

export function resetPlayback(): void {
    player.updatePlaybackTime(0, true);
}

export function seekPlayback(time: number): void {
    const media = getMedia(mediaSelection.get());
    if (!media || !player.getURL() || !Number.isFinite(time)) return;
    // Transcript highlights derive from the same time, including explicit seeks.
    player.updatePlaybackTime(Math.max(0, Math.min(media.duration, time)), true);
}

export function observePlaybackTime(id: string, time: number): void {
    const media = getMedia(id);
    if (mediaSelection.get() !== id || !media || !player.getURL() || !Number.isFinite(time)) return;
    player.updatePlaybackTime(Math.max(0, Math.min(media.duration, time)), false);
}

export function renameMedia(id: string, name: string): void {
    const trimmed = name.trim();
    if (projectState.locked || !trimmed) return;
    const media = getMedia(id);
    if (media) media.name = trimmed;
    else mediaImport.rename(id, trimmed);
}

export function removeMedia(id: string): void {
    if (projectState.locked) return;
    transcription.remove(id);
    for (const dialog of dialogs.state.dialogs) if ("mediaId" in dialog && dialog.mediaId === id) dialogs.close(dialog.id);
    const next = mediaSelection.get() === id ? mediaSelection.adjacent(1) ?? mediaSelection.adjacent(-1) : mediaSelection.get();
    if (projectState.project) {
        const index = projectState.project.vestiges.findIndex(vestige => vestige.media.id === id);
        if (index >= 0) projectState.project.vestiges.splice(index, 1);
    }
    mediaImport.remove(id);
    selectMedia(next);
}

export function retryMedia(id: string): void {
    if (!projectState.locked) mediaImport.retry(id);
}
export function relinkMedia(id: string): void {
    if (!projectState.locked) mediaImport.relink(id);
}
export function ignoreMedia(id: string): void {
    if (!projectState.locked) mediaImport.ignore(id);
}
export function reviewMedia(id: string): void {
    if (!projectState.locked) mediaImport.review(id);
}

export function close(): Promise<boolean> {
    return invokeWithLock({ kind: "close" }, async () => {
        if (!await prepareToLeave()) return false;
        await replaceProject(null, null);
        savedText = "";
        pauseAutosave();
        return true;
    });
}

export function startLifecycle(): () => void {
    lifecycleStarted = true;
    mediaImport.reset(projectState.project?.vestiges.map(vestige => vestige.media.id) ?? []);
    let checking: Promise<boolean> | null = null;
    const unsubscribe = window.api.beforeQuit(() => {
        if (rejectPendingImports() || rejectActiveTranscriptions()) return Promise.resolve(true);
        checking ??= (async () => {
            while (activeTransition) if (!await activeTransition) return true;
            while (saveTask) if (!await saveTask) return true;
            return !await invokeWithLock({ kind: "quit" }, prepareToLeave);
        })().finally(() => {
            checking = null;
        });
        return checking;
    });
    const beforeUnload = (event: BeforeUnloadEvent): void => {
        if (hasChanges() || projectState.locked || transcription.hasPending()) {
            event.preventDefault();
            event.returnValue = false;
        }
    };
    resumeAutosave();
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
        lifecycleStarted = false;
        projectGeneration++;
        transcription.clear();
        mediaImport.reset([]);
        mediaSelection.select(null);
        void player.reset().catch(reportUnexpected);
        pauseAutosave();
        unsubscribe();
        window.removeEventListener("beforeunload", beforeUnload);
    };
}