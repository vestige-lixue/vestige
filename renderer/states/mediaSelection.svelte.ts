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

export function adjacent(direction: -1 | 1, wrap = false): string | null {
    const ids = mediaImport.getReadyIds();
    const index = selected === null ? -1 : ids.indexOf(selected);
    if (index < 0 || ids.length < 2) return null;
    return ids[wrap ? (index + direction + ids.length) % ids.length : index + direction] ?? null;
}