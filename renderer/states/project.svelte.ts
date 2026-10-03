import { type Project } from "../../shared/project/Project";
import { getFileName, type AbsolutePath } from "../../shared/util/path";
import { projectVersion, autosaveInterval } from "../../shared/project/constants";
import { confirmSave } from "./confirmation.svelte";
import { clearMedia, playerState } from "./player.svelte";
import { mediaImports, type MediaItemState } from "./media.svelte";
import { type MediaInput } from "../media/media";
import { transcriptions } from "./transcription.svelte";
import { interfaceState } from "./interface.svelte";

export type ProjectActivity = {
    title: string;
    detail: string;
};

export type ProjectState = {
    path: AbsolutePath | null;
    project: Project | null;
    // Exclusive project operations and pending save confirmation.
    locked: boolean;
    // Cleared after the busy modal finishes closing.
    activity: ProjectActivity | null;
    // `true` if a project is being saved, including background autosave.
    saving: boolean;
    error: string | null;
};

export const projectState = $state<ProjectState>({
    path: null,
    project: null,
    locked: false,
    activity: null,
    saving: false,
    error: null
});

let savedText = "";
let saveTask: Promise<boolean> | null = null;
let activeTransition: Promise<boolean> | null = null;
let autosaveTimer: ReturnType<typeof setInterval> | null = null;
let lifecycleStarted = false;
let projectGeneration = 0;

// #region Utils

export function getProjectFileName(): string {
    return projectState.project ? projectState.path === null ? "<未保存>" : getFileName(projectState.path) : "";
}

function reportError(error: unknown): void {
    projectState.error = error instanceof Error ? error.message : String(error);
    console.error(projectState.error);
}

function rejectPendingImports(): boolean {
    if (!mediaImports.pending) return false;
    projectState.error = "仍有媒体尚未完成导入。请在侧栏点击删除按钮取消导入，或等待导入完成后再保存或关闭项目。";
    return true;
}

function rejectActiveTranscriptions(): boolean {
    if (!transcriptions.pending) return false;
    projectState.error = "仍有转写任务正在运行或停止。请停止任务或等待完成后，再关闭或切换项目。";
    return true;
}

function invokeWithLock(activity: ProjectActivity, action: () => Promise<boolean>): Promise<boolean> {
    if (projectState.locked || rejectPendingImports()) return Promise.resolve(false);
    projectState.locked = true;
    projectState.activity = activity;
    activeTransition = Promise.resolve().then(async () => {
        // Let an in-flight autosave finish, including any save-as recovery,
        // before another operation can replace or modify the project.
        while (saveTask) {
            projectState.activity = { title: "正在等待项目保存", detail: getProjectFileName() };
            if (!await saveTask) return false;
        }
        projectState.activity = activity;
        return action();
    }).catch(error => {
        reportError(error);
        return false;
    }).finally(() => {
        projectState.locked = false;
        activeTransition = null;
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
        if (projectState.path === null || projectState.locked || projectState.saving || projectState.error !== null || mediaImports.pending) return;
        saveCurrent();
    }, autosaveInterval);
}

//#endregion

//#region Actual Lifecycle APIs

function createProject(): Project {
    return { version: projectVersion, lastOpened: Date.now(), vestiges: [] };
}

function hasChanges(): boolean {
    return mediaImports.pending || (projectState.project !== null && (projectState.path === null || JSON.stringify(projectState.project) !== savedText));
}

async function writeCurrent(saveAs: boolean): Promise<boolean> {
    if (rejectPendingImports()) return false;
    const project = projectState.project;
    if (!project) return false;
    projectState.saving = true;
    const previousActivity = projectState.locked ? projectState.activity : null;
    let recoveryLock = false;
    let path = projectState.path;
    let lastError: string | null = null;
    try {
        for (;;) {
            // An import may start while an earlier background write is in flight.
            if (rejectPendingImports()) return false;
            try {
                if (projectState.locked) {
                    projectState.activity = {
                        title: "正在保存项目",
                        detail: saveAs || path === null ? "请选择保存位置" : path
                    };
                }
                if (saveAs || path === null) {
                    const selected = await window.api.project.selectSavePath(path);
                    if (!selected) {
                        // Cancelling save-as leaves the original failure unresolved.
                        if (lastError !== null) throw new Error(lastError);
                        return false;
                    }
                    path = selected;
                }
                if (projectState.locked) projectState.activity = { title: "正在保存项目", detail: path };
                // Snapshot once per save. Svelte proxies cannot cross Electron's structured-clone IPC.
                const snapshot = $state.snapshot(project);
                const text = JSON.stringify(snapshot);
                // Always write: an unchanged project file may have been deleted externally.
                const result = await window.api.project.saveProject(path, snapshot);
                if (!result.success) throw new Error(result.error);
                if (projectState.project === project) {
                    projectState.path = path;
                    savedText = text;
                    resumeAutosave();
                }
                return true;
            }
            catch (error) {
                pauseAutosave();
                const message = error instanceof Error ? error.message : String(error);
                lastError = message;
                console.error(message);
                if (!projectState.locked) {
                    projectState.locked = true;
                    recoveryLock = true;
                }
                const choice = await confirmSave(path ?? getProjectFileName(), message);
                if (choice === "retry") {
                    saveAs = false;
                    continue;
                }
                if (choice !== "save") {
                    if (choice === "memory") {
                        projectState.path = null;
                        savedText = "";
                    }
                    return false;
                }
                saveAs = true;
            }
        }
    }
    finally {
        projectState.saving = false;
        if (recoveryLock) {
            projectState.locked = false;
        }
        else if (previousActivity) projectState.activity = previousActivity;
    }
}

async function saveCurrent(saveAs = false): Promise<boolean> {
    while (saveTask) {
        if (projectState.locked) {
            projectState.activity = { title: "正在等待项目保存", detail: getProjectFileName() };
        }
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
        if (projectState.locked) {
            projectState.activity = { title: "正在等待项目保存", detail: getProjectFileName() };
        }
        if (!await saveTask) return false;
    }
    if (!projectState.project) return true;
    if (projectState.path === null) {
        const choice = await confirmSave(getProjectFileName());
        if (choice === "cancel") return false;
        if (choice === "discard") return true;
    }
    if (!await saveCurrent()) return false;
    // An edit or a completed Run may arrive during a save. Flush that newer
    // snapshot as well before permitting the project to be discarded.
    while (hasChanges()) {
        if (!await saveCurrent()) return false;
    }
    return true;
}

export function newProject(): Promise<boolean> {
    return invokeWithLock({ title: "正在新建项目", detail: "正在处理当前项目的更改" }, async () => {
        if (!await prepareToLeave()) return false;
        clearMedia();
        transcriptions.clear();
        projectGeneration++;
        projectState.path = null;
        projectState.project = createProject();
        mediaImports.setProject(projectState.project);
        savedText = "";
        pauseAutosave();
        return true;
    });
}

export function openProject(path?: AbsolutePath | (() => Promise<AbsolutePath>)): Promise<boolean> {
    return invokeWithLock({ title: "正在打开项目", detail: typeof path === "string" ? path : "正在选择项目文件" }, async () => {
        const selected = typeof path === "function" ? await path() : path ?? await window.api.project.selectOpenPath();
        if (!selected) return false;
        projectState.activity = { title: "正在读取并校验项目", detail: selected };
        const result = await window.api.project.getProject(selected);
        if (!result.success) throw new Error(result.error);
        if (!await prepareToLeave()) return false;
        clearMedia();
        transcriptions.clear();
        projectGeneration++;
        savedText = JSON.stringify(result.project);
        result.project.lastOpened = Date.now();
        projectState.path = selected;
        projectState.project = result.project;
        mediaImports.setProject(projectState.project);
        resumeAutosave();
        return true;
    });
}

export function saveProject(saveAs = false): Promise<boolean> {
    return invokeWithLock({ title: "正在保存项目", detail: getProjectFileName() }, () => saveCurrent(saveAs));
}

export function importMedia(sources: MediaInput[]): boolean {
    if (projectState.locked || !sources.length) return false;
    if (projectState.project) mediaImports.setProject(projectState.project);
    mediaImports.add(sources, () => {
        projectState.project ??= createProject();
        return projectState.project;
    });
    return true;
}

export async function selectMediaForImport(): Promise<void> {
    if (projectState.locked || interfaceState.pickingMedia) return;
    const generation = projectGeneration;
    interfaceState.pickingMedia = true;
    try {
        const paths = await window.api.file.selectMediaPaths();
        if (generation === projectGeneration) importMedia(paths);
    }
    catch (error) {
        if (generation === projectGeneration) reportError(error);
    }
    finally {
        interfaceState.pickingMedia = false;
    }
}

export function renameMedia(item: MediaItemState, name: string): void {
    if (!projectState.locked) mediaImports.rename(item, name);
}

export function removeMedia(item: MediaItemState): void {
    if (projectState.locked) return;
    transcriptions.remove(item);
    const dialog = interfaceState.dialog;
    if (dialog && "item" in dialog && dialog.item === item) dialog.open = false;
    if (item.vestige?.media === playerState.media) clearMedia();
    mediaImports.remove(item);
}

export function retryMedia(item: MediaItemState): void {
    if (!projectState.locked) mediaImports.retry(item);
}

export function relinkMedia(item: MediaItemState): void {
    if (!projectState.locked) mediaImports.relink(item);
}

export function ignoreMedia(item: MediaItemState): void {
    if (!projectState.locked) mediaImports.ignore(item);
}

export function reviewMedia(item: MediaItemState): void {
    if (!projectState.locked) mediaImports.review(item);
}

export function closeProject(): Promise<boolean> {
    return invokeWithLock({ title: "正在关闭项目", detail: "正在处理当前项目的更改" }, async () => {
        if (!await prepareToLeave()) return false;
        clearMedia();
        transcriptions.clear();
        projectGeneration++;
        projectState.path = null;
        projectState.project = null;
        mediaImports.setProject(null);
        savedText = "";
        pauseAutosave();
        return true;
    });
}

export function startProjectLifecycle(): () => void {
    lifecycleStarted = true;
    mediaImports.setProject(projectState.project);
    let checking: Promise<boolean> | null = null;
    const unsubscribe = window.api.beforeQuit(() => {
        if (rejectPendingImports() || rejectActiveTranscriptions()) return Promise.resolve(true);
        checking ??= (async () => {
            while (activeTransition) {
                if (!await activeTransition) return true;
            }
            while (saveTask) {
                if (!await saveTask) return true;
            }
            return !await invokeWithLock({ title: "正在退出应用", detail: "正在处理当前项目的更改" }, prepareToLeave);
        })().finally(() => {
            checking = null;
        });
        return checking;
    });
    const beforeUnload = (event: BeforeUnloadEvent): void => {
        // Reload/navigation must not turn into an application quit.
        if (hasChanges() || projectState.locked || transcriptions.pending) {
            event.preventDefault();
            event.returnValue = false;
        }
    };
    resumeAutosave();
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
        lifecycleStarted = false;
        projectGeneration++;
        transcriptions.clear();
        mediaImports.setProject(null);
        pauseAutosave();
        unsubscribe();
        window.removeEventListener("beforeunload", beforeUnload);
    };
}

//#endregion