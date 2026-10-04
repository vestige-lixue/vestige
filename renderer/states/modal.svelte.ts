import { SvelteSet } from "svelte/reactivity";

const layers = new SvelteSet<symbol>();

export function openLayer(layer: symbol): void {
    closeLayer(layer);
    layers.add(layer);
}

export function closeLayer(layer: symbol): void {
    layers.delete(layer);
}

export function getLayerIndex(layer: symbol): number {
    return 12915 + Math.max(0, [...layers].indexOf(layer)) * 2;
}

export function getTopLayer(): number {
    return 12915 + layers.size * 2;
}