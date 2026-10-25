import { type FailureInfo } from "../../shared/failure";
import { SvelteMap } from "svelte/reactivity";
import { type MediaIssueStatus } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import * as project from "./project.svelte";

export const names = new SvelteMap<string, string>();
export const items = new SvelteMap<string, ImportState>();

export type ImportState = { id: string } & ({
    stage: "queued" | "path" | "reading" | "relocating" | "ready";
} | {
    stage: MediaIssueStatus;
    error: FailureInfo;
    path: AbsolutePath;
    ignored: boolean;
});

export type ImportIssue = Extract<ImportState, { stage: MediaIssueStatus }>;

export type MediaImportFailure = { name: string | null; path: AbsolutePath | null; error: FailureInfo };

export const state = $state({
    ids: [] as string[],
    importFailures: [] as MediaImportFailure[],
    picking: false,
    collecting: false
});

export function isIssue(item: ImportState): item is ImportIssue {
    return item.stage === "missing" || item.stage === "changed" || item.stage === "unreadable";
}

export function createItem(id: string): ImportState {
    const item = $state<ImportState>({ id, stage: "queued" });
    return item;
}

export function getIds(): string[] {
    return state.ids;
}

export function get(id: string): ImportState | null {
    return items.get(id) ?? null;
}

export function getName(id: string): string {
    return project.getMedia(id)?.name ?? names.get(id) ?? "";
}

export function isReady(id: string): boolean {
    return get(id)?.stage === "ready";
}

export function isSelectable(id: string): boolean {
    const item = get(id);
    return item !== null && (item.stage === "ready" || project.getMedia(id) !== null);
}

export function getSelectableIds(): string[] {
    return state.ids.filter(isSelectable);
}

export function getReadyIds(): string[] {
    return state.ids.filter(isReady);
}

export function getImportFailures(): MediaImportFailure[] {
    return state.importFailures;
}

export function isPicking(): boolean {
    return state.picking;
}

export function isCollecting(): boolean {
    return state.collecting;
}

export function hasPendingImports(): boolean {
    return isCollecting() || state.ids.some(id => project.getMedia(id) === null);
}

export function getIssue(): ImportIssue | null {
    for (const id of state.ids) {
        const item = items.get(id);
        if (item && isIssue(item) && !item.ignored) return item;
    }
    return null;
}

export function isRelocating(): boolean {
    return state.ids.some(id => items.get(id)?.stage === "relocating");
}