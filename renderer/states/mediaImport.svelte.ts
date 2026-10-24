import { type FailureInfo } from "../../shared/failure";
import { SvelteMap } from "svelte/reactivity";
import { type MediaIssueStatus } from "../../shared/media/check";
import { type AbsolutePath } from "../../shared/util/path";
import * as project from "./project.svelte";

export const names = new SvelteMap<string, string>();

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
    items: [] as ImportState[],
    importFailures: [] as MediaImportFailure[],
    picking: false,
    collecting: false
});

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
    return state.items.filter(item => isSelectable(item.id)).map(item => item.id);
}

export function getReadyIds(): string[] {
    return state.items.filter(item => item.stage === "ready").map(item => item.id);
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
    return isCollecting() || state.items.some(item => project.getMedia(item.id) === null);
}

export function getIssue(): ImportIssue | null {
    return state.items.find((item): item is ImportIssue => isIssue(item) && !item.ignored) ?? null;
}

export function isRelocating(): boolean {
    return state.items.some(item => item.stage === "relocating");
}