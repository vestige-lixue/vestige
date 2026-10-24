export function observeFontSize(element: Element, changed: (size: string) => void): () => void {
    const sync = (): void => changed(getComputedStyle(element).fontSize);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
}

// Callers retain target filtering, preventDefault, focus and selection behavior.
export function focusIndex(event: KeyboardEvent, index: number, count: number, axis: "horizontal" | "vertical", edges = false): number | null {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || index < 0 || count === 0) return null;
    if (edges && event.key === "Home") return 0;
    if (edges && event.key === "End") return count - 1;
    const previous = axis === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const next = axis === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (event.key !== previous && event.key !== next) return null;
    return (index + (event.key === next ? 1 : -1) + count) % count;
}

// Callers retain capture registration and flushSync ordering with their focus flags.
export function dismissOutside(event: PointerEvent, contains: (target: Node) => boolean, dismiss: () => void): void {
    if (!(event.target instanceof Node) || contains(event.target)) return;
    dismiss();
}