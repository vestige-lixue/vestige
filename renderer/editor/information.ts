import { type Node as PMNode } from "@tiptap/pm/model";
import { Plugin, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { transcriptEvents, transcriptTokens, transcriptTokenGroup, type TranscriptInformation } from "./informationModel";
import { type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { textRectangles } from "./geometry";

export type InspectionInformation = TranscriptInformation | {
    key: string;
    kind: "events";
    items: TranscriptInformation[];
    range: TranscriptInformation["range"];
};

export type TranscriptInspection = {
    information: InspectionInformation;
    rectangles: DOMRect[][];
    anchor: DOMRect;
    keyboard: boolean;
    pressed: boolean;
    control: boolean;
};

export type InspectionOptions = {
    duration: number;
    onChange: (inspection: TranscriptInspection | null) => void;
    onSeek: (time: number) => void;
};

export function informationPlugin(index: TextIndex, projectionOf: (state: EditorState) => TextProjection, options: InspectionOptions): Plugin {
    function build(doc: PMNode, projection: TextProjection): {
        byKey: Map<string, InspectionInformation>;
        decorations: DecorationSet;
    } {
        const items = transcriptEvents(index, projection, options.duration);
        const markers = new Map<number, TranscriptInformation[]>();
        for (const item of items) {
            if (item.kind !== "deletion" && item.kind !== "gap") continue;
            const group = markers.get(item.from) ?? [];
            group.push(item);
            markers.set(item.from, group);
        }
        const byKey = new Map<string, InspectionInformation>();
        const decorations = [...markers].map(([position, items]) => {
            items.sort((left, right) => (left.range?.start ?? Infinity) - (right.range?.start ?? Infinity));
            const information: InspectionInformation = items.length === 1 ? items[0] : {
                key: `events/${items.map(item => item.key).join("/")}`, kind: "events", items,
                range: items.reduce<TranscriptInformation["range"]>((range, item) => !item.range ? range : !range ? item.range : {
                    start: Math.min(range.start, item.range.start), end: Math.max(range.end, item.range.end)
                }, null)
            };
            byKey.set(information.key, information);
            // Keep the default end-of-document caret inside the last text node.
            const side = position === doc.firstChild!.content.size ? 1 : -1;
            const key = `${side}/${information.key}`;
            return Decoration.widget(position + 1, () => {
                const anchor = document.createElement("span");
                anchor.className = "transcript-event-anchor";
                anchor.contentEditable = "false";
                const group = document.createElement("span");
                group.className = "transcript-events";
                // Native buttons inside contenteditable distort Chromium's IME text offsets.
                const marker = document.createElement("span");
                marker.tabIndex = 0;
                marker.className = `transcript-event ${[...new Set(items.map(item => item.kind))].join(" ")} focusable`;
                marker.dataset.inspection = information.key;
                if (items.length > 1) marker.dataset.count = String(items.length);
                const shape = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                shape.classList.add("transcript-event-shape");
                shape.setAttribute("viewBox", "0 0 10 10");
                shape.setAttribute("preserveAspectRatio", "none");
                // Cover the inner half of the stroke to preserve the triangle's filled size.
                for (const [className, path] of [
                    ["transcript-event-stroke", "M0 0H10L5 10Z"],
                    ["", "M0 0H10L5 10Z"],
                    ["transcript-event-split", "M5 0H10L5 10Z"]
                ]) {
                    const part = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    if (className) part.classList.add(className);
                    part.setAttribute("d", path);
                    shape.append(part);
                }
                marker.append(shape);
                group.append(marker);
                anchor.append(group);
                return anchor;
            }, { key, side, relaxedSide: true, marks: [], ignoreSelection: true, stopEvent: () => true });
        });
        return {
            byKey,
            decorations: DecorationSet.create(doc, decorations)
        };
    }
    const cache = new WeakMap<TextProjection, ReturnType<typeof build>>();
    function informationOf(state: EditorState): ReturnType<typeof build> {
        const projection = projectionOf(state);
        let value = cache.get(projection);
        if (!value) {
            value = build(state.doc, projection);
            cache.set(projection, value);
        }
        return value;
    }

    function rectangles(view: EditorView, item: TranscriptInformation): DOMRect[] {
        const start = view.domAtPos(item.from + 1, 1);
        const end = view.domAtPos(item.to + 1, -1);
        const range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        return textRectangles(view.dom, range);
    }

    function withinSpacing(view: EditorView, item: TranscriptInformation, rectangles: DOMRect[], x: number, y: number): boolean {
        const start = view.domAtPos(item.from + 1, 1).node;
        const span = (start instanceof Element ? start : start.parentElement)?.closest(".transcript-text");
        if (!span) return false;
        const style = getComputedStyle(span);
        const top = (parseFloat(style.marginTop) || 0) + (parseFloat(style.paddingTop) || 0);
        const right = (parseFloat(style.marginRight) || 0) + (parseFloat(style.paddingRight) || 0);
        const bottom = (parseFloat(style.marginBottom) || 0) + (parseFloat(style.paddingBottom) || 0);
        const left = (parseFloat(style.marginLeft) || 0) + (parseFloat(style.paddingLeft) || 0);
        return rectangles.some(rect => x >= rect.left - left && x <= rect.right + right
            && y >= rect.top - top && y <= rect.bottom + bottom);
    }

    function tokenRectangles(view: EditorView, item: TranscriptInformation): DOMRect[][] {
        return transcriptTokenGroup(index, projectionOf(view.state), item).map(part => rectangles(view, part));
    }

    function distanceTo(rect: DOMRect, x: number, y: number): number {
        return Math.max(rect.left - x, 0, x - rect.right) ** 2 + Math.max(rect.top - y, 0, y - rect.bottom) ** 2;
    }

    let composing = false;
    const plugin: Plugin<DecorationSet> = new Plugin({
        state: {
            init: (_, state) => informationOf(state).decorations,
            apply: (transaction, decorations, _oldState, state) => composing ? decorations.map(transaction.mapping, transaction.doc)
                : informationOf(state).decorations
        },
        props: { decorations: state => plugin.getState(state) ?? DecorationSet.empty },
        view(view) {
            type Target = Omit<TranscriptInspection, "control">;
            let inspectionFocus: TranscriptInspection | null = null;
            let control = false;
            let pointer: { x: number; y: number; pressed: boolean } | null = null;
            let hovered: Target | null = null;
            let keyboard: Target | null = null;
            let priority: "pointer" | "keyboard" = "pointer";
            let activation: string | null = null;
            let compositionTimer: ReturnType<typeof setTimeout> | undefined;
            function inspect(preferred = priority): void {
                priority = preferred;
                view.dom.classList.toggle("transcript-seek", control && !!hovered?.information.range);
                // Keep both targets: the latest input wins, and ending it reveals the other.
                const target = priority === "pointer" ? hovered ?? keyboard : keyboard ?? hovered;
                const next = target ? { ...target, control } : null;
                if (!next && !inspectionFocus) return;
                if (next && inspectionFocus?.information === next.information && inspectionFocus.rectangles === next.rectangles
                    && inspectionFocus.anchor.top === next.anchor.top && inspectionFocus.anchor.left === next.anchor.left
                    && inspectionFocus.anchor.width === next.anchor.width && inspectionFocus.anchor.height === next.anchor.height
                    && inspectionFocus.keyboard === next.keyboard && inspectionFocus.pressed === next.pressed && inspectionFocus.control === control) return;
                inspectionFocus = next;
                options.onChange(next);
            }
            function eventMarker(target: EventTarget | null): HTMLElement | null {
                return target instanceof Element ? target.closest<HTMLElement>(".transcript-event") : null;
            }
            function hoverTarget(measure = false): Target | null {
                if (!pointer || view.composing || !document.hasFocus()) return null;
                const { x, y, pressed } = pointer;
                const element = document.elementFromPoint(x, y);
                if (!element || !view.dom.contains(element)) return null;
                const data = informationOf(view.state);
                const button = eventMarker(element);
                if (button) {
                    const item = data.byKey.get(button.dataset.inspection!);
                    if (item) return { information: item, rectangles: [], anchor: button.getBoundingClientRect(), keyboard: false, pressed };
                }
                const position = view.posAtCoords({ left: x, top: y });
                if (!position) return null;
                const offset = position.pos - 1;
                const candidates = transcriptTokens(index, projectionOf(view.state), offset);
                // At a boundary try the following token first, then the preceding token's spacing.
                for (const item of candidates.reverse()) {
                    if (!item || offset < item.from || offset > item.to) continue;
                    const boxes = !measure && hovered?.information === item ? hovered.rectangles : tokenRectangles(view, item);
                    const rects = boxes.flat();
                    let anchor = rects.find(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
                    if (!anchor && rects.length && withinSpacing(view, item, rects, x, y)) {
                        anchor = rects.reduce((closest, rect) => distanceTo(rect, x, y) < distanceTo(closest, x, y) ? rect : closest);
                    }
                    if (!anchor) continue;
                    return { information: item, rectangles: boxes, anchor, keyboard: false, pressed };
                }
                return null;
            }
            function keyboardTarget(element: EventTarget | null = document.activeElement): Target | null {
                if (view.composing || !document.hasFocus()) return null;
                const button = eventMarker(element);
                if (button && view.dom.contains(button) && button.matches(":focus-visible")) {
                    const item = informationOf(view.state).byKey.get(button.dataset.inspection!);
                    if (item) return { information: item, rectangles: [], anchor: button.getBoundingClientRect(), keyboard: true, pressed: false };
                }
                if (!control || element !== view.dom) return null;
                const { selection } = view.state;
                if (!selection.empty) return null;
                const offset = selection.head - 1;
                const item = transcriptTokens(index, projectionOf(view.state), offset).find(item => item.from <= offset && offset < item.to);
                // A caret at a boundary belongs to the following character; the document end has none.
                if (!item || offset < item.from) return null;
                const boxes = tokenRectangles(view, item);
                const rects = boxes.flat();
                const position = view.coordsAtPos(selection.head);
                const anchor = rects.find(rect => position.top < rect.bottom && position.bottom > rect.top && position.left >= rect.left && position.left <= rect.right)
                    ?? rects[0] ?? new DOMRect(position.left, position.top, position.right - position.left, position.bottom - position.top);
                return { information: item, rectangles: boxes, anchor, keyboard: true, pressed: false };
            }
            function setControl(value: boolean): boolean {
                if (control === value) return false;
                control = value;
                activation = null;
                keyboard = keyboardTarget();
                return true;
            }
            function move(event: PointerEvent): void {
                if (event.pointerType === "touch" || view.composing) return leave();
                const changed = setControl(event.ctrlKey && !event.altKey && !event.metaKey);
                pointer = { x: event.clientX, y: event.clientY, pressed: event.buttons !== 0 };
                hovered = hoverTarget();
                inspect(hovered ? "pointer" : changed && control ? "keyboard" : priority);
            }
            function leave(): void {
                pointer = null;
                hovered = null;
                activation = null;
                inspect();
            }
            function modifiers(event: KeyboardEvent): void {
                const next = event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing && !view.composing;
                if (setControl(next)) {
                    hovered = hoverTarget();
                    inspect(control ? "keyboard" : priority);
                }
                if (event.type === "keydown" && event.key === "Enter" && control && !event.shiftKey && (view.dom.contains(document.activeElement) || hovered)) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!event.repeat && inspectionFocus?.information.range) options.onSeek(inspectionFocus.information.range.start);
                }
            }
            function down(event: PointerEvent): void {
                activation = null;
                move(event);
                if (event.button !== 0 || !control || !hovered?.information.range) return;
                // Suppress native caret/word selection while using Ctrl-click as an audio link.
                event.preventDefault();
                event.stopPropagation();
                activation = hovered.information.key;
            }
            function click(event: MouseEvent): void {
                const item = hovered?.information;
                const key = activation;
                activation = null;
                if (event.button !== 0 || !event.ctrlKey || event.altKey || event.metaKey || !item?.range || item.key !== key) return;
                event.preventDefault();
                event.stopPropagation();
                options.onSeek(item.range.start);
            }
            function reset(): void {
                control = false;
                hovered = null;
                keyboard = null;
                activation = null;
                inspect();
            }
            function focus(event: FocusEvent): void {
                keyboard = keyboardTarget(event.target);
                hovered = hoverTarget();
                inspect("keyboard");
            }
            function blur(event: FocusEvent): void {
                keyboard = keyboardTarget(event.relatedTarget);
                hovered = hoverTarget();
                inspect();
            }
            function refresh(): void {
                if (view.isDestroyed) return;
                hovered = hoverTarget(true);
                keyboard = keyboardTarget();
                inspect();
            }
            function compositionStart(): void {
                clearTimeout(compositionTimer);
                composing = true;
                reset();
            }
            function compositionEnd(): void {
                compositionTimer = setTimeout(() => {
                    if (view.isDestroyed || view.composing) return;
                    composing = false;
                    view.dispatch(view.state.tr.setMeta("addToHistory", false));
                    refresh();
                }, 0);
            }
            const observer = new ResizeObserver(refresh);
            observer.observe(view.dom);
            view.dom.addEventListener("pointermove", move);
            view.dom.addEventListener("pointerleave", leave);
            view.dom.addEventListener("pointerdown", down, true);
            view.dom.addEventListener("pointerup", move, true);
            view.dom.addEventListener("click", click, true);
            view.dom.addEventListener("pointercancel", leave);
            view.dom.addEventListener("focusin", focus, true);
            view.dom.addEventListener("focusout", blur, true);
            view.dom.addEventListener("compositionstart", compositionStart);
            view.dom.addEventListener("compositionend", compositionEnd);
            window.addEventListener("keydown", modifiers, true);
            window.addEventListener("keyup", modifiers, true);
            window.addEventListener("blur", reset);
            window.addEventListener("focus", refresh);
            window.addEventListener("scroll", refresh, true);
            return {
                update(view, previous) {
                    const changed = view.state.doc !== previous.doc;
                    if (changed) {
                        activation = null;
                        hovered = hoverTarget(true);
                    }
                    if (changed || !view.state.selection.eq(previous.selection)) {
                        keyboard = keyboardTarget();
                        inspect(control ? "keyboard" : priority);
                    }
                },
                destroy() {
                    clearTimeout(compositionTimer);
                    observer.disconnect();
                    view.dom.removeEventListener("pointermove", move);
                    view.dom.removeEventListener("pointerleave", leave);
                    view.dom.removeEventListener("pointerdown", down, true);
                    view.dom.removeEventListener("pointerup", move, true);
                    view.dom.removeEventListener("click", click, true);
                    view.dom.removeEventListener("pointercancel", leave);
                    view.dom.removeEventListener("focusin", focus, true);
                    view.dom.removeEventListener("focusout", blur, true);
                    view.dom.removeEventListener("compositionstart", compositionStart);
                    view.dom.removeEventListener("compositionend", compositionEnd);
                    window.removeEventListener("keydown", modifiers, true);
                    window.removeEventListener("keyup", modifiers, true);
                    window.removeEventListener("blur", reset);
                    window.removeEventListener("focus", refresh);
                    window.removeEventListener("scroll", refresh, true);
                    reset();
                }
            };
        }
    });
    return plugin;
}