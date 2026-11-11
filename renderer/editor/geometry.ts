import { type EditorState } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
import { type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { transcriptTokens, transcriptTokenGroup, transcriptSelection, type InspectionInformation, type SelectionInformation } from "./informationModel";
import { compositionPending } from "./composition";
import { transcriptLayoutVersion } from "./layout";

// Read text fragments instead of enclosing element boxes, which may span multiple lines.
export function textRectangles(root: HTMLElement, range: Range, includeBreaks = false): DOMRect[] {
    const result: DOMRect[] = [];
    const filter = {
        acceptNode: node => {
            const element = node instanceof Element ? node : node.parentElement;
            const readonly = element?.closest("[contenteditable=\"false\"]");
            if (readonly && readonly !== root && root.contains(readonly)) return NodeFilter.FILTER_REJECT;
            return node.nodeType === Node.TEXT_NODE || includeBreaks && node instanceof HTMLBRElement
                && !node.classList.contains("ProseMirror-trailingBreak") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
    } satisfies NodeFilter;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, filter);
    walker.currentNode = range.startContainer.childNodes[range.startOffset] ?? range.startContainer;
    const textRange = document.createRange();
    let node = filter.acceptNode(walker.currentNode) === NodeFilter.FILTER_ACCEPT ? walker.currentNode : walker.nextNode();
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

export function transcriptRectangles(view: EditorView, item: { from: number; to: number }, includeBreaks = false): DOMRect[] {
    const start = view.domAtPos(item.from + 1, 1);
    const end = view.domAtPos(item.to + 1, -1);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return textRectangles(view.dom, range, includeBreaks);
}
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
    rectangles: (information: InspectionInformation) => DOMRect[][];
    caretAnchor: (rectangles: DOMRect[][], position: number) => DOMRect;
    scrolled: () => void;
    hover: (pointer: InspectionPointer | null, options?: { selection?: boolean }) => InspectionTarget | null;
    overTextOrMarker: (point: Point) => boolean;
    keyboard: (control: boolean, element?: EventTarget | null) => InspectionTarget | null;
};

type ViewportGeometry = {
    layout: number;
    scroll: number;
    projection: TextProjection;
    groups: Map<string, DOMRect[][]>;
    hit?: { from: number; to: number; boxes: DOMRect[] };
    spacing?: { from: number; value: Spacing | null };
    caret?: { position: number; rect: DOMRect };
};

export function inspectionGeometry(
    view: EditorView, index: TextIndex, projectionOf: (state: EditorState) => TextProjection,
    events: () => Map<string, InspectionInformation>, duration: number
): InspectionGeometry {
    let selected: {
        projection: TextProjection;
        from: number;
        to: number;
        information: SelectionInformation | null;
    } | undefined;
    let scroll = 0;
    let cached: ViewportGeometry | undefined;
    const empty: DOMRect[][] = [];
    function viewport(): ViewportGeometry {
        const layout = transcriptLayoutVersion(view), projection = projectionOf(view.state);
        if (!cached || cached.layout !== layout || cached.scroll !== scroll || cached.projection !== projection) {
            cached = { layout, scroll, projection, groups: new Map() };
        }
        return cached;
    }
    function eventMarker(target: EventTarget | null): HTMLElement | null {
        return target instanceof Element ? target.closest<HTMLElement>(".transcript-event") : null;
    }
    function rectangles(item: { from: number; to: number }): DOMRect[] {
        return transcriptRectangles(view, item);
    }
    function informationRectangles(information: InspectionInformation): DOMRect[][] {
        if (information.kind !== "selection" && information.kind !== "token") return empty;
        const cache = viewport();
        // Split pieces of a token share an outline. A menu may recreate information for the same selection.
        const key = information.kind === "selection" ? `selection/${information.selectionFrom}/${information.selectionTo}` : information.key;
        const previous = cache.groups.get(key);
        if (previous) return previous;
        const fragments = information.kind === "selection" ? information.fragments : transcriptTokenGroup(index, cache.projection, duration, information);
        const boxes = fragments.map(rectangles);
        if (cache.groups.size === 8) cache.groups.delete(cache.groups.keys().next().value!);
        cache.groups.set(key, boxes);
        return boxes;
    }
    function hitRectangles(target: { from: number; to: number }): DOMRect[] {
        const cache = viewport();
        if (cache.hit?.from !== target.from || cache.hit.to !== target.to) {
            cache.hit = { from: target.from, to: target.to, boxes: rectangles(target) };
        }
        return cache.hit.boxes;
    }
    function caretAnchor(boxes: DOMRect[][], position: number): DOMRect {
        const cache = viewport();
        if (cache.caret?.position !== position) {
            const { left, top, right, bottom } = view.coordsAtPos(position);
            cache.caret = { position, rect: new DOMRect(left, top, right - left, bottom - top) };
        }
        return keyboardRectangle(boxes.flat(), cache.caret.rect) ?? cache.caret.rect;
    }
    function spacingOf(item: { from: number }): Spacing | null {
        const cache = viewport();
        if (cache.spacing?.from === item.from) return cache.spacing.value;
        const start = view.domAtPos(item.from + 1, 1).node;
        const span = (start instanceof Element ? start : start.parentElement)?.closest(".transcript-text");
        const style = span ? getComputedStyle(span) : null;
        const value = style && {
            top: (parseFloat(style.marginTop) || 0) + (parseFloat(style.paddingTop) || 0),
            right: (parseFloat(style.marginRight) || 0) + (parseFloat(style.paddingRight) || 0),
            bottom: (parseFloat(style.marginBottom) || 0) + (parseFloat(style.paddingBottom) || 0),
            left: (parseFloat(style.marginLeft) || 0) + (parseFloat(style.paddingLeft) || 0)
        };
        cache.spacing = { from: item.from, value };
        return value;
    }
    function blocked(): boolean {
        return compositionPending(view.state) || view.composing;
    }
    function selectionGeometry(): typeof selected {
        const { from, to, empty } = view.state.selection;
        if (empty) return selected = undefined;
        const projection = projectionOf(view.state);
        if (!selected || selected.projection !== projection || selected.from !== from - 1 || selected.to !== to - 1) {
            selected = {
                projection, from: from - 1, to: to - 1,
                information: transcriptSelection(index, projection, duration, from - 1, to - 1)
            };
        }
        return selected;
    }
    function selectionAtCaret(keyboard: boolean): InspectionTarget | null {
        const target = selectionGeometry();
        if (!target?.information) return null;
        const boxes = informationRectangles(target.information);
        const anchor = caretAnchor(boxes, view.state.selection.head);
        return { information: target.information, rectangles: boxes, anchor, keyboard, pressed: !keyboard };
    }
    return {
        rectangles: informationRectangles,
        caretAnchor,
        scrolled() {
            scroll++;
        },
        hover(pointer, { selection = true } = {}) {
            if (!pointer || blocked()) return null;
            const { x, y, pressed } = pointer;
            // Native drag selection can lag behind the pointer as it crosses a token boundary.
            if (selection && pressed && !view.state.selection.empty) return selectionAtCaret(false);
            const element = document.elementFromPoint(x, y);
            if (!element || !view.dom.contains(element)) return null;
            const button = eventMarker(element);
            if (button) {
                const item = events().get(button.dataset.inspection!);
                if (item) return { information: item, rectangles: empty, anchor: button.getBoundingClientRect(), keyboard: false, pressed };
            }
            if (selection) {
                const target = selectionGeometry();
                if (target?.information) {
                    const spacing = spacingOf(target) ?? { top: 0, right: 0, bottom: 0, left: 0 };
                    const hit = pointerRectangle(hitRectangles(target), pointer, spacing);
                    if (hit) {
                        const boxes = informationRectangles(target.information);
                        const anchor = pointerRectangle(boxes.flat(), pointer, spacing) ?? hit;
                        return { information: target.information, rectangles: boxes, anchor, keyboard: false, pressed };
                    }
                }
            }
            const position = view.posAtCoords({ left: x, top: y });
            if (!position) return null;
            const offset = position.pos - 1;
            // At a boundary try the following token first, then the preceding token's spacing.
            for (const item of transcriptTokens(index, projectionOf(view.state), duration, offset).reverse()) {
                if (offset < item.from || offset > item.to) continue;
                const boxes = informationRectangles(item);
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
        overTextOrMarker({ x, y }) {
            // Use native inline hit boxes at fractional boundaries and include text beneath transparent marker anchors.
            for (const element of document.elementsFromPoint(x, y)) {
                if (!view.dom.contains(element)) break;
                if (element.matches(".transcript-text, .transcript-event")) return true;
            }
            return false;
        },
        keyboard(control, element = document.activeElement) {
            if (blocked() || !document.hasFocus()) return null;
            const button = eventMarker(element);
            if (button && view.dom.contains(button) && button.matches(":focus-visible")) {
                const item = events().get(button.dataset.inspection!);
                if (item) return { information: item, rectangles: empty, anchor: button.getBoundingClientRect(), keyboard: true, pressed: false };
            }
            if (!control || element !== view.dom) return null;
            if (!view.state.selection.empty) return selectionAtCaret(true);
            const offset = view.state.selection.head - 1;
            // A caret at a boundary belongs to the following character; the document end has none.
            const item = transcriptTokens(index, projectionOf(view.state), duration, offset).find(item => item.from <= offset && offset < item.to);
            if (!item) return null;
            const boxes = informationRectangles(item);
            const anchor = caretAnchor(boxes, view.state.selection.head);
            return { information: item, rectangles: boxes, anchor, keyboard: true, pressed: false };
        }
    };
}