import { type EditorView } from "@tiptap/pm/view";

// Hard breaks have no glyph. Selection blocks and hover hints share these boxes outside contenteditable.
export type LineBreakBox = {
    /** ProseMirror position immediately before the hard break. */
    pos: number;
    /** Relative to the overlay origin; top and height are the break's text box, like a character's. */
    left: number;
    top: number;
    height: number;
    /** The hint is one em wide. */
    width: number;
    /** The line gap above and below the text box, which also belongs to the hover area. */
    gap: number;
    fontSize: number;
    added: boolean;
};

export function measureLineBreaks(view: EditorView, origin: DOMRect): LineBreakBox[] {
    const boxes: LineBreakBox[] = [];
    const range = document.createRange();
    for (const element of view.dom.querySelectorAll("br")) {
        // ProseMirror's trailing break only holds an empty last line; expanded deletions are read-only previews.
        if (element.classList.contains("ProseMirror-trailingBreak") || element.closest("[contenteditable=\"false\"]")) continue;
        range.selectNode(element);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        const fontSize = parseFloat(getComputedStyle(element).fontSize);
        const gap = element.parentElement ? parseFloat(getComputedStyle(element.parentElement).paddingTop) || 0 : 0;
        boxes.push({
            pos: view.posAtDOM(element, 0, -1),
            left: rect.left - origin.left, top: rect.top - origin.top, height: rect.height, width: fontSize, gap, fontSize,
            added: !!element.closest(".transcript-added")
        });
    }
    return boxes;
}

export function sameLineBreaks(left: readonly LineBreakBox[], right: readonly LineBreakBox[]): boolean {
    return left.length === right.length && left.every((box, i) => {
        const other = right[i];
        return box.pos === other.pos && box.left === other.left && box.top === other.top && box.height === other.height && box.width === other.width
            && box.gap === other.gap && box.fontSize === other.fontSize && box.added === other.added;
    });
}

/** The index of the break whose text box, extended by its line gap, contains the point; -1 if none. */
export function lineBreakAt(boxes: readonly LineBreakBox[], x: number, y: number): number {
    return boxes.findIndex(box => x >= box.left && x <= box.left + box.width && y >= box.top - box.gap && y <= box.top + box.height + box.gap);
}