import { SvelteSet } from "svelte/reactivity";

const layers = new SvelteSet<symbol>();
let restoringFocus: HTMLElement | null = null;

export function restoreFocus(target: Element | null): void {
    if (!(target instanceof HTMLElement) || !target.isConnected || target === target.ownerDocument.body) return;
    const previous = restoringFocus;
    restoringFocus = target;
    try {
        target.focus();
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