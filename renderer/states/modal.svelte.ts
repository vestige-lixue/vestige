import { SvelteSet } from "svelte/reactivity";

// Each layer reserves one position for its overlay and one for its content.
const layerBase = 12915;
const layerStep = 2;
const layers = new SvelteSet<symbol>();
const blockingLayers = new SvelteSet<symbol>();
const layerListeners = new SvelteSet<() => void>();
let restoringFocus: HTMLElement | null = null;

export function restoreFocus(target: Element | null, options?: FocusOptions): void {
    if (!(target instanceof HTMLElement) || !target.isConnected || target === target.ownerDocument.body) return;
    const previous = restoringFocus;
    restoringFocus = target;
    try {
        target.focus(options);
    }
    catch {
        target.ownerDocument.body.focus();
    }
    finally {
        restoringFocus = previous;
    }
}

export function isRestoringFocus(target: HTMLElement | null): boolean {
    // Focus events run synchronously inside focus(); hover and later Tab navigation are unaffected.
    return target !== null && target === restoringFocus;
}

export function openLayer(layer: symbol, blocking = false): void {
    layers.delete(layer);
    layers.add(layer);
    if (blocking) blockingLayers.add(layer);
    else blockingLayers.delete(layer);
    for (const listener of layerListeners) listener();
}

export function closeLayer(layer: symbol): void {
    if (!layers.delete(layer)) return;
    blockingLayers.delete(layer);
    for (const listener of layerListeners) listener();
}

export function hasBlockingLayer(): boolean {
    return blockingLayers.size > 0;
}

export function subscribeModalLayers(listener: () => void): () => void {
    layerListeners.add(listener);
    return () => layerListeners.delete(listener);
}

export function hasOpenLayer(): boolean {
    return layers.size > 0;
}

export function getLayerIndex(layer: symbol): number {
    return layerBase + Math.max(0, [...layers].indexOf(layer)) * layerStep;
}

export function getTopLayer(): number {
    return layerBase + layers.size * layerStep;
}