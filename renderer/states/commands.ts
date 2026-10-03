import { closeProject, newProject, openProject, projectState, saveProject, selectMediaForImport } from "./project.svelte";
import { mediaImports, type MediaItemState } from "./media.svelte";
import { interfaceState, type ApplicationDialog } from "./interface.svelte";
import { transcriptions } from "./transcription.svelte";
import { playerState, setCurrentTime, togglePlaying } from "./player.svelte";
import { saveConfirmation } from "./confirmation.svelte";

export type Command = "new" | "open" | "save" | "saveAs" | "close" | "quit" | "import" | "transcribe"
    | "vocabulary" | "tasks" | "settings" | "about" | "play" | "previousMedia" | "nextMedia" | "previousWord" | "nextWord";

// Guard execution without changing the UI's feature availability.
export function interfaceBlocked(): boolean {
    return projectState.locked || projectState.error !== null || saveConfirmation.fileName !== null
        || interfaceState.dialog !== null || interfaceState.pickingMedia
        || mediaImports.issue !== null || mediaImports.importFailures.length > 0 || mediaImports.selecting;
}

export function transcriptionDisabled(item: MediaItemState | null): boolean {
    return !item?.vestige || item.ignored || item.stage !== "ready"
        || transcriptions.taskFor(item)?.status === "stopping";
}

export function runMediaTranscription(item: MediaItemState): void {
    if (interfaceBlocked() || transcriptionDisabled(item)) return;
    const task = transcriptions.taskFor(item);
    if (task && task.status !== "failed") transcriptions.stop(item);
    else interfaceState.dialog = { kind: task ? "failure" : "transcription", item, open: true };
}

export function openPanel(kind: Extract<ApplicationDialog["kind"], "vocabulary" | "tasks" | "settings">): void {
    if (!interfaceBlocked()) interfaceState.dialog = { kind, open: true };
}

export function wordPosition(direction: -1 | 1): number | null {
    const vestige = mediaImports.selected?.vestige;
    const segments = vestige?.runs[vestige.primaryRunIdx]?.transcript ?? [];
    const starts = segments.filter(segment => segment.token.text.trim()).map(segment => segment.range.start).sort((a, b) => a - b);
    return direction === 1 ? starts.find(time => time > playerState.currentTime + 0.001) ?? null
        : starts.findLast(time => time < playerState.currentTime - 0.001) ?? null;
}

export function commandDisabled(command: Command): boolean {
    switch (command) {
        case "save": return !mediaImports.pending && (!projectState.project || projectState.path !== null);
        case "saveAs": case "close": return !projectState.project && !mediaImports.pending;
        case "transcribe": return transcriptionDisabled(mediaImports.selected);
        case "play": return !playerState.media;
        case "previousMedia": return mediaImports.adjacent(-1) === null;
        case "nextMedia": return mediaImports.adjacent(1) === null;
        case "previousWord": return !playerState.media || wordPosition(-1) === null;
        case "nextWord": return !playerState.media || wordPosition(1) === null;
        default: return false;
    }
}

export function runCommand(command: Command): void {
    if (interfaceBlocked() || commandDisabled(command)) return;
    switch (command) {
        case "new": void newProject(); break;
        case "open": void openProject(); break;
        case "save": void saveProject(); break;
        case "saveAs": void saveProject(true); break;
        case "close": closeProject(); break;
        case "quit": void closeProject().then(closed => {
            if (closed) window.api.quit();
        }); break;
        case "import": void selectMediaForImport(); break;
        case "transcribe": if (mediaImports.selected) runMediaTranscription(mediaImports.selected); break;
        case "about": openPanel("settings"); break;
        case "play": togglePlaying(); break;
        case "previousMedia": mediaImports.moveSelection(-1); break;
        case "nextMedia": mediaImports.moveSelection(1); break;
        case "previousWord": case "nextWord": {
            const time = wordPosition(command === "previousWord" ? -1 : 1);
            if (time !== null) setCurrentTime(time);
            break;
        }
        default: openPanel(command);
    }
}