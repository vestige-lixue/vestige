import { type EditorView } from "@tiptap/pm/view";
import { transcriptLayoutVersion } from "./layout";
import { transcriptViewport } from "./viewport";
import { walkTranscriptDOM } from "./textDOM";
import { type TextWindow } from "../../shared/transcript/find";

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

const layouts = new WeakMap<EditorView, { version: number; window: TextWindow; boxes: LineBreakBox[] }>();
const carets = new WeakMap<EditorView, { version: number; pos: number; box: LineBreakBox | null }>();

function overlayOrigin(view: EditorView): DOMRect {
    return view.dom.parentElement!.getBoundingClientRect();
}

function breakBox(element: HTMLBRElement, pos: number, origin: DOMRect, fontSize: number, gaps: Map<string, number>, range: Range): LineBreakBox | null {
    range.selectNode(element);
    const rect = range.getClientRects()[0];
    if (!rect) return null;
    const parent = element.parentElement!;
    const category = parent.classList.contains("transcript-text") ? "text" : "plain";
    let gap = gaps.get(category);
    if (gap === undefined) {
        gap = parseFloat(getComputedStyle(parent).paddingTop) || 0;
        gaps.set(category, gap);
    }
    return {
        pos, left: rect.left - origin.left, top: rect.top - origin.top, height: rect.height, width: fontSize, gap, fontSize,
        added: !!element.closest(".transcript-added")
    };
}

/** The caret hint needs one known hard break, independently of whether anyone needs a viewport. */
export function measureCaretLineBreak(view: EditorView): LineBreakBox | null {
    const { empty, from, $from } = view.state.selection;
    if (!empty || !view.hasFocus() || $from.nodeAfter?.type.name !== "hardBreak") return null;
    const version = transcriptLayoutVersion(view), previous = carets.get(view);
    if (previous?.version === version && previous.pos === from) return previous.box;
    const element = view.nodeDOM(from);
    const range = document.createRange();
    const box = element instanceof HTMLBRElement ? breakBox(element, from, overlayOrigin(view), parseFloat(getComputedStyle(view.dom).fontSize), new Map(), range) : null;
    range.setStart(view.dom, 0);
    range.collapse(true);
    const layout = { version, pos: from, box: box && previous?.box && sameLineBreaks([previous.box], [box]) ? previous.box : box };
    carets.set(view, layout);
    return layout.box;
}

export function measureLineBreaks(view: EditorView): LineBreakBox[] {
    const version = transcriptLayoutVersion(view);
    const window = transcriptViewport(view);
    const previous = layouts.get(view);
    if (previous?.version === version && previous.window.from === window.from && previous.window.to === window.to) return previous.boxes;
    const origin = overlayOrigin(view);
    const boxes: LineBreakBox[] = [];
    const range = document.createRange();
    // Original/added text inherits the editor font. Only transcript-text parents add line-gap padding.
    const fontSize = parseFloat(getComputedStyle(view.dom).fontSize);
    const gaps = new Map<string, number>();
    walkTranscriptDOM(view, window, (element, from) => {
        if (!(element instanceof HTMLBRElement)) return;
        const box = breakBox(element, from + 1, origin, fontSize, gaps, range);
        if (box) boxes.push(box);
    });
    range.setStart(view.dom, 0);
    range.collapse(true);
    const layout = { version, window, boxes: previous && sameLineBreaks(previous.boxes, boxes) ? previous.boxes : boxes };
    layouts.set(view, layout);
    return layout.boxes;
}

function sameLineBreaks(left: readonly LineBreakBox[], right: readonly LineBreakBox[]): boolean {
    return left.length === right.length && left.every((box, i) => {
        const other = right[i];
        return box.pos === other.pos && box.left === other.left && box.top === other.top && box.height === other.height && box.width === other.width
            && box.gap === other.gap && box.fontSize === other.fontSize && box.added === other.added;
    });
}

/** The index of the break whose text box, extended by its line gap, contains the point; -1 if none. */
export function lineBreakAt(view: EditorView, clientX: number, clientY: number): number {
    const boxes = measureLineBreaks(view);
    if (!boxes.length) return -1;
    const origin = overlayOrigin(view);
    const x = clientX - origin.left, y = clientY - origin.top;
    // Chromium's inline hit boxes can stop just before a fractional br rectangle, especially with display scaling.
    const tolerance = 1;
    return boxes.findIndex(box => x >= box.left - tolerance && x <= box.left + box.width + tolerance
        && y >= box.top - box.gap - tolerance && y <= box.top + box.height + box.gap + tolerance);
}