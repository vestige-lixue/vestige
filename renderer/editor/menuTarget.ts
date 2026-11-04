import { TextSelection, type EditorState, type Selection } from "@tiptap/pm/state";
import { type Node as PMNode } from "@tiptap/pm/model";
import { type EditorView } from "@tiptap/pm/view";
import { closeHistory } from "@tiptap/pm/history";
import { type EditAction } from "../../shared/app";
import { textPieces, restoreTextDeletion, type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { transcriptSelection, transcriptTokenGroup, type InspectionInformation, type TranscriptInformation } from "./informationModel";
import { keyboardRectangle, pointerRectangle, type InspectionGeometry, type InspectionTarget } from "./geometry";
import { compositionPending } from "./composition";
import { projectionTransaction } from "./projectionStep";

export type TranscriptMenuTarget = {
    kind: "deletion" | "gap" | "token" | "selection" | "text";
    // ProseMirror positions; inspection information continues to use displayed UTF-16 offsets.
    from: number;
    to: number;
    position: number;
    information: InspectionInformation | null;
    selectionKind?: "original" | "mixed" | "added";
    expanded?: boolean;
};
export type TranscriptMenuRequest = {
    view: EditorView;
    doc: PMNode;
    target: TranscriptMenuTarget;
    selection: Selection;
    anchor: DOMRect;
    keyboard: boolean;
};
export type TranscriptMenuCallbacks = {
    open: (request: TranscriptMenuRequest | null) => boolean;
    edit: (action: EditAction) => void;
};
type MenuController = {
    close: () => void;
    edit: (action: EditAction) => boolean;
    update: () => void;
    destroy: () => void;
};
const controllers = new WeakMap<EditorView, MenuController>();
const clipboardActions = ["cut", "copy", "paste"] as const;

export function transcriptMenuClipboardActions(target: TranscriptMenuTarget): readonly EditAction[] {
    return target.kind === "selection" ? clipboardActions : target.kind === "token" || target.kind === "text" ? ["paste"] : [];
}

export function closeTranscriptMenu(view: EditorView): void {
    controllers.get(view)?.close();
}

export function editTranscriptMenu(view: EditorView, action: EditAction): boolean {
    return controllers.get(view)?.edit(action) ?? false;
}

export function restoreTranscriptMenuSelection(request: TranscriptMenuRequest): boolean {
    const { view, doc, selection } = request;
    if (view.isDestroyed || view.state.doc !== doc || view.composing || compositionPending(view.state)) return false;
    if (!view.state.selection.eq(selection)) view.dispatch(view.state.tr.setSelection(selection).setMeta("addToHistory", false));
    view.focus();
    return true;
}

export function canRestoreDeletion(view: EditorView, information: TranscriptInformation | null): information is TranscriptInformation & { original: string } {
    return !view.isDestroyed && view.editable && !view.composing && !compositionPending(view.state)
        && information?.kind === "deletion" && !!information.original;
}

export function restoreDeletion(view: EditorView, information: TranscriptInformation | null, index: TextIndex, projection: TextProjection): boolean {
    if (!canRestoreDeletion(view, information)) return false;
    const restored = restoreTextDeletion(index, projection, information.sourceFrom, information.sourceTo);
    if (restored === projection) return false;
    // Explicit projection writes preserve added text and map the current selection through the insertion.
    view.dispatch(closeHistory(projectionTransaction(view.state, projection, restored,
        { from: information.from, to: information.from, text: information.original })).scrollIntoView());
    view.focus();
    return true;
}

function eventMarker(view: EditorView, target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element) || !view.dom.contains(target)) return null;
    // Gaps rendered inside a deletion preview belong to the enclosing deletion menu.
    const expanded = target.closest(".transcript-deletion-expanded");
    return expanded ? expanded.querySelector<HTMLElement>(".transcript-event.deletion") : target.closest<HTMLElement>(".transcript-event");
}

export function transcriptMenuController(
    view: EditorView, index: TextIndex, projectionOf: (state: EditorState) => TextProjection, duration: number,
    events: () => Map<string, TranscriptInformation>, geometry: InspectionGeometry,
    pin: (target: (() => InspectionTarget | null) | null, pending?: boolean) => void, callbacks: TranscriptMenuCallbacks
): MenuController {
    let current: TranscriptMenuRequest | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let keyboard = false;
    let composingRequest = false;
    const listeners = new AbortController();
    const capture = { capture: true, signal: listeners.signal };
    const blocked = (): boolean => view.isDestroyed || view.composing || compositionPending(view.state);

    function measure(target: TranscriptMenuTarget, keyboard: boolean, point?: { x: number; y: number }): InspectionTarget | null {
        const information = target.information;
        if (!information) return null;
        if (target.kind === "deletion" || target.kind === "gap") {
            const marker = view.dom.querySelector<HTMLElement>(`.transcript-event[data-inspection="${CSS.escape(information.key)}"]`);
            return marker ? { information, rectangles: [], anchor: marker.getBoundingClientRect(), keyboard, pressed: false } : null;
        }
        const rectangles = geometry.rectangles(information);
        const rects = rectangles.flat();
        const caret = view.coordsAtPos(target.position);
        const anchor = point && pointerRectangle(rects, point, { top: 0, right: 0, bottom: 0, left: 0 })
            || keyboardRectangle(rects, caret) || new DOMRect(caret.left, caret.top, caret.right - caret.left, caret.bottom - caret.top);
        return { information, rectangles, anchor, keyboard, pressed: false };
    }

    function resolve(event: MouseEvent, fromKeyboard: boolean): TranscriptMenuTarget | null {
        const marker = eventMarker(view, fromKeyboard ? document.activeElement : event.target);
        if (marker) {
            const information = events().get(marker.dataset.inspection!);
            if (information && information.kind !== "token") return { kind: information.kind, information, from: information.from + 1, to: information.to + 1,
                position: information.from + 1, expanded: marker.getAttribute("aria-expanded") === "true" };
        }
        const hitPosition = fromKeyboard ? view.state.selection.head : view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (hitPosition === undefined) return null;
        // Editor padding maps outside the paragraph, but still supports paste at Blink's native caret.
        const position = Math.max(1, Math.min(view.state.doc.content.size - 1, hitPosition));
        const projection = projectionOf(view.state);
        const selection = view.state.selection;
        if (!selection.empty && (fromKeyboard || hitPosition >= selection.from && hitPosition <= selection.to)) {
            const from = selection.from - 1, to = selection.to - 1;
            const pieces = textPieces(index, projection, from, to, true).filter(piece => Math.max(from, piece.utf16From) < Math.min(to, piece.utf16To));
            const original = pieces.some(piece => piece.source.kind === "segment");
            const added = pieces.some(piece => piece.source.kind !== "segment");
            const information = transcriptSelection(index, projection, duration, from, to);
            return { kind: "selection", from: (information?.from ?? from) + 1, to: (information?.to ?? to) + 1, position, information,
                selectionKind: original ? added ? "mixed" : "original" : "added" };
        }
        const point = { x: event.clientX, y: event.clientY, pressed: false };
        const hit = fromKeyboard ? geometry.keyboard(true, view.dom) : geometry.hover(point, null, { selection: false, measure: true });
        if (hit?.information.kind === "token") {
            const fragments = transcriptTokenGroup(index, projection, hit.information);
            return { kind: "token", from: Math.min(...fragments.map(item => item.from)) + 1, to: Math.max(...fragments.map(item => item.to)) + 1, position, information: hit.information };
        }
        return { kind: "text", from: position, to: position, position, information: null };
    }

    function close(): void {
        clearTimeout(timer);
        timer = undefined;
        if (current) {
            current = null;
            callbacks.open(null);
        }
        pin(null);
    }

    function show(request: TranscriptMenuRequest): void {
        if (blocked() || request.doc !== view.state.doc) return close();
        if (request.target.kind !== "deletion" && request.target.kind !== "gap") {
            // Native right-button down can move the DOM caret before ProseMirror observes it.
            const selection = document.getSelection();
            if (selection?.anchorNode && selection.focusNode && view.dom.contains(selection.anchorNode) && view.dom.contains(selection.focusNode)) {
                const position = (node: Node, offset: number): number => Math.max(1, Math.min(view.state.doc.content.size - 1, view.posAtDOM(node, offset)));
                request.selection = TextSelection.create(view.state.doc, position(selection.anchorNode, selection.anchorOffset), position(selection.focusNode, selection.focusOffset));
                if (!view.state.selection.eq(request.selection)) view.dispatch(view.state.tr.setSelection(request.selection).setMeta("addToHistory", false));
            }
        }
        if (!callbacks.open(request)) return close();
        current = request;
        pin(() => measure(request.target, request.keyboard, request.keyboard ? undefined : { x: request.anchor.x, y: request.anchor.y }));
    }

    function down(event: MouseEvent): void {
        if (event.type === "pointerdown") {
            close();
            composingRequest = event.button === 2 && blocked();
            // Suppress inspection from right-button down until contextmenu opens the menu.
            if (event.button === 2 && !composingRequest) pin(null, true);
        }
        keyboard = false;
        if (event.button === 2 && (composingRequest || blocked() || eventMarker(view, event.target))) event.preventDefault();
    }
    view.dom.addEventListener("pointerdown", down, capture);
    view.dom.addEventListener("mousedown", down, capture);
    window.addEventListener("pointerup", event => {
        if (event.button !== 2 || current) return;
        // A release outside the editor may not generate contextmenu; don't leave inspection suppressed.
        clearTimeout(timer);
        timer = setTimeout(close, 0);
    }, capture);
    window.addEventListener("pointercancel", close, { signal: listeners.signal });
    view.dom.addEventListener("keydown", event => {
        keyboard = event.key === "ContextMenu" || event.key === "F10" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
        composingRequest = keyboard && blocked();
        if (composingRequest) event.preventDefault();
    }, capture);
    view.dom.addEventListener("contextmenu", event => {
        event.preventDefault();
        const fromKeyboard = keyboard;
        const composing = composingRequest;
        keyboard = false;
        composingRequest = false;
        close();
        if (composing || blocked()) return;
        const target = resolve(event, fromKeyboard);
        if (!target) return;
        pin(null, true);
        const caret = view.coordsAtPos(view.state.selection.head);
        const anchor = fromKeyboard ? measure(target, true)?.anchor ?? new DOMRect(caret.left, caret.top, caret.right - caret.left, caret.bottom - caret.top)
            : new DOMRect(event.clientX, event.clientY, 0, 0);
        show({ view, doc: view.state.doc, target, selection: view.state.selection, anchor, keyboard: fromKeyboard });
    }, capture);
    window.addEventListener("blur", close, { signal: listeners.signal });
    const controller: MenuController = {
        close,
        edit(action) {
            if (!current) return false;
            callbacks.edit(action);
            return true;
        },
        update() {
            const request = current;
            if (request && (blocked() || request.doc !== view.state.doc)) close();
        },
        destroy() {
            listeners.abort();
            close();
            controllers.delete(view);
        }
    };
    controllers.set(view, controller);
    return controller;
}