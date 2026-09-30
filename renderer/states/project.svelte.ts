import { type Project } from "../../shared/project/Project";
import { type Vestige } from "../../shared/Vestige";
import { projectVersion, autosaveInterval } from "../../shared/project/constants";
import { confirmSave } from "./confirmation.svelte";
import { clearMedia } from "./player.svelte";

export type ProjectState = {
    path: string | null;
    project: Project | null;
    // `true` if a project is being opened, or (waiting to be) saved. This is used to disable menu items and prevent the user from closing the window during a transition.
    locked: boolean;
    // `true` if a project is being saved.
    // `locked` but not `saving`: Opening a project.
    saving: boolean;
    error: string | null;
};

export const projectState = $state<ProjectState>({
    path: null,
    project: null,
    locked: false,
    saving: false,
    error: null
});

let savedText = "";
let saveTask: Promise<boolean> | null = null;
let activeTransition: Promise<boolean> | null = null;

// #region Utils

export function getProjectFileName(): string {
    return projectState.path?.split(/[\\/]/).pop() ?? "<未保存>";
}

function reportError(error: unknown): void {
    projectState.error = error instanceof Error ? error.message : String(error);
    console.error(projectState.error);
}

function invokeWithLock(action: () => Promise<boolean>): Promise<boolean> {
    if (projectState.locked) return Promise.resolve(false);
    projectState.locked = true;
    activeTransition = action().catch(error => {
        reportError(error);
        return false;
    }).finally(() => {
        projectState.locked = false;
        activeTransition = null;
    });
    return activeTransition;
}

//#endregion

function createProject(): Project {
    return { version: projectVersion, lastOpened: Date.now(), vestiges: [] };
}

function hasChanges(): boolean {
    return projectState.project !== null && (projectState.path === null || JSON.stringify(projectState.project) !== savedText);
}

async function writeCurrent(saveAs: boolean, force: boolean): Promise<boolean> {
    const project = projectState.project;
    if (!project) return false;
    projectState.saving = true;
    try {
        const path = saveAs || !projectState.path
            ? await window.api.project.selectSavePath(projectState.path)
            : projectState.path;
        if (!path) return false;
        // Snapshot once per save, never once per keystroke. Svelte proxies cannot be passed directly through Electron's structured-clone IPC.
        const snapshot = $state.snapshot(project);
        const text = JSON.stringify(snapshot);
        if (!force && !saveAs && projectState.path === path && text === savedText) return true;
        const result = await window.api.project.saveProject(path, snapshot);
        if (!result.success) throw new Error(result.error);
        if (projectState.project === project) {
            projectState.path = path;
            savedText = text;
            projectState.error = null;
        }
        return true;
    }
    catch (error) {
        reportError(error);
        return false;
    }
    finally {
        projectState.saving = false;
    }
}

async function saveCurrent(saveAs = false, force = false): Promise<boolean> {
    while (saveTask) await saveTask;
    saveTask = writeCurrent(saveAs, force).finally(() => {
        saveTask = null;
    });
    return saveTask;
}

async function prepareToLeave(): Promise<boolean> {
    while (saveTask) await saveTask;
    if (!hasChanges()) return true;
    const choice = await confirmSave(getProjectFileName());
    if (choice === "cancel") return false;
    if (choice === "discard") return true;
    if (!await saveCurrent()) return false;
    // An edit or a completed Run may arrive during a save. Flush that newer
    // snapshot as well before permitting the project to be discarded.
    while (hasChanges()) {
        if (!await saveCurrent()) return false;
    }
    return true;
}

export function newProject(): Promise<boolean> {
    return invokeWithLock(async () => {
        if (!await prepareToLeave()) return false;
        clearMedia();
        projectState.path = null;
        projectState.project = createProject();
        projectState.error = null;
        savedText = "";
        return true;
    });
}

export function openProject(path?: string): Promise<boolean> {
    return invokeWithLock(async () => {
        const selected = path ?? await window.api.project.selectOpenPath();
        if (!selected) return false;
        if (!await prepareToLeave()) return false;
        const result = await window.api.project.getProject(selected);
        if (!result.success) throw new Error(result.error);
        clearMedia();
        savedText = JSON.stringify(result.project);
        result.project.lastOpened = Date.now();
        projectState.path = selected;
        projectState.project = result.project;
        projectState.error = null;
        return true;
    });
}

export function saveProject(saveAs = false): Promise<boolean> {
    return invokeWithLock(() => saveCurrent(saveAs, true));
}

export function addVestiges(load: () => Promise<Vestige[]>): Promise<boolean> {
    return invokeWithLock(async () => {
        const vestiges = await load();
        projectState.project ??= createProject();
        projectState.project.vestiges.push(...vestiges);
        projectState.error = null;
        return true;
    });
}

export function closeProject(): Promise<boolean> {
    return invokeWithLock(async () => {
        if (!await prepareToLeave()) return false;
        clearMedia();
        projectState.path = null;
        projectState.project = null;
        projectState.error = null;
        savedText = "";
        return true;
    });
}

export function startProjectLifecycle(): () => void {
    let checking: Promise<boolean> | null = null;
    const unsubscribe = window.api.beforeQuit(() => {
        checking ??= (async () => {
            while (activeTransition) await activeTransition;
            return !await invokeWithLock(prepareToLeave);
        })().finally(() => {
            checking = null;
        });
        return checking;
    });
    const beforeUnload = (event: BeforeUnloadEvent): void => {
        // Reload/navigation must not turn into an application quit.
        if (hasChanges() || projectState.locked) {
            event.preventDefault();
            event.returnValue = false;
        }
    };
    const interval = setInterval(() => {
        if (!projectState.path || projectState.locked || projectState.saving) return;
        saveCurrent();
    }, autosaveInterval);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
        clearInterval(interval);
        unsubscribe();
        window.removeEventListener("beforeunload", beforeUnload);
    };
}