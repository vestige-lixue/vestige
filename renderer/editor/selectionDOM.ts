import { type EditorView } from "@tiptap/pm/view";

export type TranscriptPreviewPoint = { node: Text; offset: number };

export function transcriptPreviewBoundary(original: HTMLElement, end: boolean): TranscriptPreviewPoint | null {
    const walker = original.ownerDocument.createTreeWalker(original, NodeFilter.SHOW_TEXT, {
        acceptNode: node => node.textContent && !node.parentElement?.closest(".transcript-event") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const node = (end ? walker.lastChild() : walker.nextNode()) as Text | null;
    return node ? { node, offset: end ? node.length : 0 } : null;
}

/** Hit only the pressed island. Outside hits clamp to the nearest line fragment's text edge. */
export function transcriptPreviewPoint(original: HTMLElement, x: number, y: number): TranscriptPreviewPoint | null {
    const document = original.ownerDocument;
    function hit(left: number, top: number): TranscriptPreviewPoint | null {
        const caret = document.caretPositionFromPoint(left, top);
        const node = caret?.offsetNode;
        return node instanceof Text && original.contains(node) && !node.parentElement?.closest(".transcript-event")
            ? { node, offset: caret!.offset } : null;
    }
    const rectangles = [...original.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
    if (!rectangles.length) return null;
    if (y < rectangles[0].top) return transcriptPreviewBoundary(original, false);
    if (y > rectangles.at(-1)!.bottom) return transcriptPreviewBoundary(original, true);
    const distance = (rect: DOMRect): number => Math.max(rect.top - y, y - rect.bottom, 0);
    const line = rectangles.reduce((nearest, rect) => distance(rect) < distance(nearest) ? rect : nearest);
    const direct = x >= line.left && x <= line.right ? hit(x, y) : null;
    if (direct) return direct;
    const end = x >= (line.left + line.right) / 2;
    if (!end && line === rectangles[0] || end && line === rectangles.at(-1)) return transcriptPreviewBoundary(original, end);
    const style = document.defaultView!.getComputedStyle(original);
    const padding = parseFloat(end ? style.paddingRight : style.paddingLeft) || 0;
    for (const inset of [.5, 2, 4, 8]) {
        const edge = Math.min(line.width / 2, padding + inset);
        const point = hit(end ? line.right - edge : line.left + edge, (line.top + line.bottom) / 2);
        if (point) return point;
    }
    return transcriptPreviewBoundary(original, end);
}

export function transcriptPreviewOriginal(view: EditorView, node: EventTarget | null | undefined): HTMLElement | null {
    const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
    const original = element?.closest<HTMLElement>(".transcript-deletion-original");
    return original && view.dom.contains(original) ? original : null;
}

export function transcriptPreviewSelection(view: EditorView): Range | null {
    const selection = view.dom.ownerDocument.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || range.collapsed) return null;
    const original = transcriptPreviewOriginal(view, range.startContainer);
    return original && original === transcriptPreviewOriginal(view, range.endContainer) ? range : null;
}

export function restoreTranscriptDOMSelection(view: EditorView): void {
    const { anchor, head } = view.state.selection;
    const start = view.domAtPos(anchor, anchor <= head ? 1 : -1);
    const end = view.domAtPos(head, anchor <= head ? -1 : 1);
    view.dom.ownerDocument.getSelection()?.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
}