import * as mediaImport from "./mediaImport.svelte";

let selected = $state<string | null>(null);

export function get(): string | null {
    return selected;
}

export function select(id: string | null): boolean {
    if (id !== null && !mediaImport.isReady(id)) return false;
    if (selected === id) return false;
    selected = id;
    return true;
}

export function adjacent(direction: -1 | 1): string | null {
    const ids = mediaImport.getReadyIds();
    const index = selected === null ? -1 : ids.indexOf(selected);
    return index < 0 ? null : ids[index + direction] ?? null;
}