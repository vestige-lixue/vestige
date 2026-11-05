import * as mediaImport from "./mediaImport.svelte";
import * as project from "./project.svelte";

export function get(): string | null {
    return project.projectState.project?.selectedMediaId ?? null;
}

export function select(id: string | null): boolean {
    const current = project.projectState.project;
    if (!current || current.selectedMediaId === id || (id !== null && !mediaImport.isSelectable(id))) return false;
    current.selectedMediaId = id;
    return true;
}

export function adjacent(direction: -1 | 1, wrap = false, mode: "selectable" | "ready" = "selectable"): string | null {
    const ids = mode === "ready" ? mediaImport.getReadyIds() : mediaImport.getSelectableIds();
    const selected = get();
    const index = selected === null ? -1 : ids.indexOf(selected);
    if (index < 0 || ids.length < 2) return null;
    return ids[wrap ? (index + direction + ids.length) % ids.length : index + direction] ?? null;
}