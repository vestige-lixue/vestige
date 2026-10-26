import { type EditorState } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
import { type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { transcriptTokens, transcriptTokenGroup, transcriptSelection, type InspectionInformation, type TranscriptInformation } from "./informationModel";
import { compositionPending } from "./composition";

// Read text fragments instead of enclosing element boxes, which may span multiple lines.
export function textRectangles(root: HTMLElement, range: Range, includeBreaks = false): DOMRect[] {
    const result: DOMRect[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: node => node.nodeType === Node.TEXT_NODE || includeBreaks && node instanceof HTMLBRElement
            && !node.classList.contains("ProseMirror-trailingBreak") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    });
    walker.currentNode = range.startContainer.childNodes[range.startOffset] ?? range.startContainer;
    const textRange = document.createRange();
    let node = walker.currentNode.nodeType === Node.TEXT_NODE || includeBreaks && walker.currentNode instanceof HTMLBRElement
        ? walker.currentNode : walker.nextNode();
    while (node && range.comparePoint(node, 0) <= 0) {
        if (range.intersectsNode(node)) {
            if (node.nodeType === Node.TEXT_NODE) {
                textRange.setStart(node, node === range.startContainer ? range.startOffset : 0);
                textRange.setEnd(node, node === range.endContainer ? range.endOffset : node.textContent!.length);
            }
            else {
                const index = Array.prototype.indexOf.call(node.parentNode!.childNodes, node) as number;
                if (range.comparePoint(node.parentNode!, index) !== 0 || range.comparePoint(node.parentNode!, index + 1) !== 0) {
                    node = walker.nextNode();
                    continue;
                }
                textRange.selectNode(node);
            }
            for (let rect of textRange.getClientRects()) {
                if (includeBreaks && node instanceof HTMLBRElement && !node.classList.contains("ProseMirror-trailingBreak")) {
                    rect = new DOMRect(rect.x, rect.y, Math.max(rect.width, parseFloat(getComputedStyle(node).fontSize) / 2), rect.height);
                }
                if (rect.width < .5 || rect.height < .5) continue;
                const previous = result.at(-1);
                if (previous && Math.abs(previous.top - rect.top) < 1 && Math.abs(previous.bottom - rect.bottom) < 1
                    && rect.left <= previous.right + 1 && rect.right >= previous.left - 1) {
                    result[result.length - 1] = new DOMRect(Math.min(previous.left, rect.left), Math.min(previous.top, rect.top),
                        Math.max(previous.right, rect.right) - Math.min(previous.left, rect.left), Math.max(previous.bottom, rect.bottom) - Math.min(previous.top, rect.top));
                }
                else result.push(rect);
            }
        }
        node = walker.nextNode();
    }
    return result;
}

export type InspectionTarget = {
    information: InspectionInformation;
    rectangles: DOMRect[][];
    anchor: DOMRect;
    keyboard: boolean;
    pressed: boolean;
};
export type InspectionPointer = { x: number; y: number; pressed: boolean };
export type Spacing = { top: number; right: number; bottom: number; left: number };
type Point = { x: number; y: number };
type Rectangle = { top: number; right: number; bottom: number; left: number };

function distanceTo(rect: Rectangle, point: Point): number {
    return Math.max(rect.left - point.x, 0, point.x - rect.right) ** 2 + Math.max(rect.top - point.y, 0, point.y - rect.bottom) ** 2;
}

// Pure hit rules operate on already measured rectangles; DOM access stays in the adapter below.
export function pointerRectangle<T extends Rectangle>(rectangles: readonly T[], point: Point, spacing: Spacing): T | undefined {
    const containing = rectangles.find(rect => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
    if (containing) return containing;
    const withinSpacing = rectangles.some(rect => point.x >= rect.left - spacing.left && point.x <= rect.right + spacing.right
        && point.y >= rect.top - spacing.top && point.y <= rect.bottom + spacing.bottom);
    return withinSpacing ? rectangles.reduce((closest, rect) => distanceTo(rect, point) < distanceTo(closest, point) ? rect : closest) : undefined;
}

export function keyboardRectangle<T extends Rectangle>(rectangles: readonly T[], caret: Rectangle): T | undefined {
    return rectangles.find(rect => caret.top < rect.bottom && caret.bottom > rect.top && caret.left >= rect.left && caret.left <= rect.right) ?? rectangles[0];
}

export type InspectionGeometry = {
    hover: (pointer: InspectionPointer | null, previous: InspectionTarget | null, measure?: boolean) => InspectionTarget | null;
    keyboard: (control: boolean, element?: EventTarget | null) => InspectionTarget | null;
};

export function inspectionGeometry(
    view: EditorView, index: TextIndex, projectionOf: (state: EditorState) => TextProjection,
    events: () => Map<string, InspectionInformation>, duration: number
): InspectionGeometry {
    function eventMarker(target: EventTarget | null): HTMLElement | null {
        return target instanceof Element ? target.closest<HTMLElement>(".transcript-event") : null;
    }
    function rectangles(item: { from: number; to: number }): DOMRect[] {
        const start = view.domAtPos(item.from + 1, 1);
        const end = view.domAtPos(item.to + 1, -1);
        const range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        return textRectangles(view.dom, range);
    }
    function tokenRectangles(item: TranscriptInformation): DOMRect[][] {
        return transcriptTokenGroup(index, projectionOf(view.state), item).map(rectangles);
    }
    function spacingOf(item: TranscriptInformation): Spacing | null {
        const start = view.domAtPos(item.from + 1, 1).node;
        const span = (start instanceof Element ? start : start.parentElement)?.closest(".transcript-text");
        if (!span) return null;
        const style = getComputedStyle(span);
        return {
            top: (parseFloat(style.marginTop) || 0) + (parseFloat(style.paddingTop) || 0),
            right: (parseFloat(style.marginRight) || 0) + (parseFloat(style.paddingRight) || 0),
            bottom: (parseFloat(style.marginBottom) || 0) + (parseFloat(style.paddingBottom) || 0),
            left: (parseFloat(style.marginLeft) || 0) + (parseFloat(style.paddingLeft) || 0)
        };
    }
    function blocked(): boolean {
        return compositionPending(view.state) || view.composing || !document.hasFocus();
    }
    return {
        hover(pointer, previous, measure = false) {
            if (!pointer || blocked()) return null;
            const { x, y, pressed } = pointer;
            const element = document.elementFromPoint(x, y);
            if (!element || !view.dom.contains(element)) return null;
            const button = eventMarker(element);
            if (button) {
                const item = events().get(button.dataset.inspection!);
                if (item) return { information: item, rectangles: [], anchor: button.getBoundingClientRect(), keyboard: false, pressed };
            }
            const position = view.posAtCoords({ left: x, top: y });
            if (!position) return null;
            const offset = position.pos - 1;
            // At a boundary try the following token first, then the preceding token's spacing.
            for (const item of transcriptTokens(index, projectionOf(view.state), offset).reverse()) {
                if (offset < item.from || offset > item.to) continue;
                const boxes = !measure && previous?.information === item ? previous.rectangles : tokenRectangles(item);
                const rects = boxes.flat();
                let anchor = pointerRectangle(rects, pointer, { top: 0, right: 0, bottom: 0, left: 0 });
                if (!anchor) {
                    const spacing = spacingOf(item);
                    if (spacing) anchor = pointerRectangle(rects, pointer, spacing);
                }
                if (anchor) return { information: item, rectangles: boxes, anchor, keyboard: false, pressed };
            }
            return null;
        },
        keyboard(control, element = document.activeElement) {
            if (blocked()) return null;
            const button = eventMarker(element);
            if (button && view.dom.contains(button) && button.matches(":focus-visible")) {
                const item = events().get(button.dataset.inspection!);
                if (item) return { information: item, rectangles: [], anchor: button.getBoundingClientRect(), keyboard: true, pressed: false };
            }
            if (!control || element !== view.dom) return null;
            if (!view.state.selection.empty) {
                const selection = view.state.selection;
                const item = transcriptSelection(index, projectionOf(view.state), duration, selection.from - 1, selection.to - 1);
                if (!item) return null;
                const boxes = rectangles(item);
                const caret = view.coordsAtPos(selection.head);
                const anchor = keyboardRectangle(boxes, caret) ?? new DOMRect(caret.left, caret.top, caret.right - caret.left, caret.bottom - caret.top);
                return { information: item, rectangles: [boxes], anchor, keyboard: true, pressed: false };
            }
            const offset = view.state.selection.head - 1;
            // A caret at a boundary belongs to the following character; the document end has none.
            const item = transcriptTokens(index, projectionOf(view.state), offset).find(item => item.from <= offset && offset < item.to);
            if (!item) return null;
            const boxes = tokenRectangles(item);
            const caret = view.coordsAtPos(view.state.selection.head);
            const anchor = keyboardRectangle(boxes.flat(), caret) ?? new DOMRect(caret.left, caret.top, caret.right - caret.left, caret.bottom - caret.top);
            return { information: item, rectangles: boxes, anchor, keyboard: true, pressed: false };
        }
    };
}