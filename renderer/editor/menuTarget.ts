import { TextSelection, type EditorState, type Selection } from "@tiptap/pm/state";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { type EditorView } from "@tiptap/pm/view";
import { closeHistory } from "@tiptap/pm/history";
import { type ContextMenuParams, type EditAction } from "../../shared/app";
import { textPieces, type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { transcriptSelection, transcriptTokenGroup, type AddedInformation, type InspectionInformation, type TranscriptInformation } from "./informationModel";
import { keyboardRectangle, pointerRectangle, transcriptRectangles, type InspectionGeometry, type InspectionTarget } from "./geometry";
import { compositionPending } from "./composition";

export type TranscriptMenuTarget = {
    kind: "deletion" | "gap" | "token" | "selection" | "word";
    // ProseMirror positions; inspection information continues to use displayed UTF-16 offsets.
    from: number;
    to: number;
    position: number;
    information: InspectionInformation | null;
    selectionKind?: "original" | "mixed" | "added";
    word?: string;
    expanded?: boolean;
};
export type TranscriptMenuRequest = {
    view: EditorView;
    doc: PMNode;
    target: TranscriptMenuTarget;
    selection: Selection;
    anchor: DOMRect;
    keyboard: boolean;
    spelling: ContextMenuParams | null;
};
export type TranscriptMenuCallbacks = {
    open: (request: TranscriptMenuRequest | null) => boolean;
    edit: (action: EditAction) => void;
};
export type TranscriptMenuSpelling = {
    word: string;
    suggestions: readonly string[];
    range: { from: number; to: number } | null;
};
type MenuController = {
    receive: (params: ContextMenuParams) => void;
    close: () => void;
    edit: (action: EditAction) => boolean;
    update: () => void;
    destroy: () => void;
};
const controllers = new WeakMap<EditorView, MenuController>();
const clipboardActions = ["cut", "copy", "paste"] as const;

export function transcriptMenuClipboardActions(target: TranscriptMenuTarget): readonly EditAction[] {
    return target.kind === "selection" ? clipboardActions : target.kind === "token" || target.kind === "word" ? ["paste"] : [];
}

export function receiveTranscriptMenu(view: EditorView, params: ContextMenuParams): void {
    controllers.get(view)?.receive(params);
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

export function transcriptMenuSpelling(request: TranscriptMenuRequest): TranscriptMenuSpelling | null {
    const { doc, target, selection, spelling } = request;
    if (target.kind !== "token" && target.kind !== "word" || !spelling?.misspelledWord.trim()) return null;
    const word = spelling.misspelledWord;
    let range: TranscriptMenuSpelling["range"] = null;
    if (doc.textBetween(selection.from, selection.to, "", "\n") === word) range = { from: selection.from, to: selection.to };
    else {
        // Blink's word can cross token marks and deletion widgets. Search only around this click.
        const start = Math.max(1, target.position - word.length);
        const end = Math.min(doc.content.size - 1, target.position + word.length);
        const text = doc.textBetween(start, end, "", "\n");
        for (let offset = text.indexOf(word); offset !== -1; offset = text.indexOf(word, offset + 1)) {
            const from = start + offset, to = from + word.length;
            if (from <= target.position && target.position <= to) {
                range = { from, to };
                break;
            }
        }
    }
    return { word, suggestions: spelling.dictionarySuggestions, range };
}

export function replaceTranscriptSpelling(request: TranscriptMenuRequest, suggestion: string): boolean {
    const { view, doc } = request;
    if (view.isDestroyed || view.state.doc !== doc || !view.editable || view.composing || compositionPending(view.state)) return false;
    const spelling = transcriptMenuSpelling(request);
    if (!spelling?.range || !spelling.suggestions.includes(suggestion) || !restoreTranscriptMenuSelection(request)) return false;
    const { from, to } = spelling.range;
    view.dispatch(closeHistory(view.state.tr).insertText(suggestion, from, to).scrollIntoView());
    return true;
}

export function canRestoreDeletion(view: EditorView, information: TranscriptInformation | null): information is TranscriptInformation & { original: string } {
    return !view.isDestroyed && view.editable && !view.composing && !compositionPending(view.state)
        && information?.kind === "deletion" && !!information.original;
}

export function restoreDeletion(view: EditorView, information: TranscriptInformation | null): boolean {
    if (!canRestoreDeletion(view, information)) return false;
    const nodes = information.original.split("\n").flatMap((line, index) => [
        ...index ? [view.state.schema.nodes.hardBreak.create()] : [],
        ...line ? [view.state.schema.text(line)] : []
    ]);
    const position = information.from + 1;
    // The transaction maps the existing selection; restoring elsewhere must not move it to this deletion.
    view.dispatch(closeHistory(view.state.tr).replaceWith(position, position, Fragment.fromArray(nodes)).scrollIntoView());
    view.focus();
    return true;
}

function eventMarker(view: EditorView, target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element) || !view.dom.contains(target)) return null;
    // Gaps rendered inside a deletion preview belong to the enclosing deletion menu.
    const expanded = target.closest(".transcript-deletion-expanded");
    return expanded ? expanded.querySelector<HTMLElement>(".transcript-event.deletion") : target.closest<HTMLElement>(".transcript-event");
}

function addedInformation(from: number, to: number): AddedInformation {
    return { key: `added/${from}/${to}`, kind: "added", from, to, sourceFrom: 0, sourceTo: 0,
        range: null, original: null, probability: null, blankProbability: null };
}

export function transcriptMenuController(
    view: EditorView, index: TextIndex, projectionOf: (state: EditorState) => TextProjection, duration: number,
    events: () => Map<string, TranscriptInformation>, geometry: InspectionGeometry,
    pin: (target: (() => InspectionTarget | null) | null, pending?: boolean) => void, callbacks: TranscriptMenuCallbacks
): MenuController {
    let pending: TranscriptMenuRequest | null = null;
    let current: TranscriptMenuRequest | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let keyboard = false;
    let composingRequest = false;
    const listeners = new AbortController();
    const capture = { capture: true, signal: listeners.signal };
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    const blocked = (): boolean => view.isDestroyed || view.composing || compositionPending(view.state);

    function measure(target: TranscriptMenuTarget, keyboard: boolean, point?: { x: number; y: number }): InspectionTarget | null {
        const information = target.information;
        if (!information) return null;
        if (target.kind === "deletion" || target.kind === "gap") {
            const marker = view.dom.querySelector<HTMLElement>(`.transcript-event[data-inspection="${CSS.escape(information.key)}"]`);
            return marker ? { information, rectangles: [], anchor: marker.getBoundingClientRect(), keyboard, pressed: false } : null;
        }
        const rectangles = transcriptRectangles(view, { from: target.from - 1, to: target.to - 1 }, true);
        const caret = view.coordsAtPos(target.position);
        const anchor = point && pointerRectangle(rectangles, point, { top: 0, right: 0, bottom: 0, left: 0 })
            || keyboardRectangle(rectangles, caret) || new DOMRect(caret.left, caret.top, caret.right - caret.left, caret.bottom - caret.top);
        return { information, rectangles: [rectangles], anchor, keyboard, pressed: false };
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
            const information = transcriptSelection(index, projection, duration, from, to) ?? addedInformation(from, to);
            return { kind: "selection", from: information.from + 1, to: information.to + 1, position, information,
                selectionKind: original ? added ? "mixed" : "original" : "added" };
        }
        const point = { x: event.clientX, y: event.clientY, pressed: false };
        const hit = fromKeyboard ? geometry.keyboard(true, view.dom) : geometry.hover(point, null, { selection: false, measure: true });
        if (hit?.information.kind === "token") {
            const fragments = transcriptTokenGroup(index, projection, hit.information);
            return { kind: "token", from: Math.min(...fragments.map(item => item.from)) + 1, to: Math.max(...fragments.map(item => item.to)) + 1, position, information: hit.information };
        }
        const segments = segmenter.segment(projection.text);
        const offset = position - 1;
        for (const part of [segments.containing(offset), segments.containing(offset - 1)]) {
            if (!part?.isWordLike) continue;
            const from = part.index, to = from + part.segment.length;
            if (!fromKeyboard && !pointerRectangle(transcriptRectangles(view, { from, to }), point, { top: 0, right: 0, bottom: 0, left: 0 })) continue;
            return { kind: "word", from: from + 1, to: to + 1, position, information: addedInformation(from, to), word: part.segment };
        }
        return { kind: "word", from: position, to: position, position, information: null };
    }

    function close(): void {
        clearTimeout(timer);
        timer = undefined;
        pending = null;
        if (current) {
            current = null;
            callbacks.open(null);
        }
        pin(null);
    }

    function show(request: TranscriptMenuRequest): void {
        clearTimeout(timer);
        timer = undefined;
        pending = null;
        if (blocked() || request.doc !== view.state.doc) return close();
        if (request.target.kind !== "deletion" && request.target.kind !== "gap") {
            // Blink may select a misspelling after contextmenu but before the main-process push.
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
            // Suppress inspection through mouseup and the asynchronous main-process push.
            if (event.button === 2 && !composingRequest) pin(null, true);
        }
        keyboard = false;
        if (event.button === 2 && (composingRequest || blocked() || eventMarker(view, event.target))) event.preventDefault();
    }
    view.dom.addEventListener("pointerdown", down, capture);
    view.dom.addEventListener("mousedown", down, capture);
    window.addEventListener("pointerup", event => {
        if (event.button !== 2 || current || pending) return;
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
        const fromKeyboard = keyboard;
        const composing = composingRequest;
        keyboard = false;
        composingRequest = false;
        close();
        if (composing || blocked()) {
            event.preventDefault();
            return;
        }
        const target = resolve(event, fromKeyboard);
        if (!target) return;
        pin(null, true);
        const marker = target.kind === "deletion" || target.kind === "gap";
        if (marker) event.preventDefault();
        const caret = view.coordsAtPos(view.state.selection.head);
        const anchor = fromKeyboard ? measure(target, true)?.anchor ?? new DOMRect(caret.left, caret.top, caret.right - caret.left, caret.bottom - caret.top)
            : new DOMRect(event.clientX, event.clientY, 0, 0);
        const request = { view, doc: view.state.doc, target, selection: view.state.selection, anchor, keyboard: fromKeyboard, spelling: null } satisfies TranscriptMenuRequest;
        if (marker) show(request);
        else {
            pending = request;
            timer = setTimeout(() => {
                if (pending === request) show(request);
            }, 200);
        }
    }, capture);
    window.addEventListener("blur", close, { signal: listeners.signal });
    const controller: MenuController = {
        receive(params) {
            if (!pending) return;
            // Ignore a delayed push for a different click; keyboard anchoring uses our own rectangles.
            if (!pending.keyboard && (Math.abs(params.x - pending.anchor.x) > 1 || Math.abs(params.y - pending.anchor.y) > 1)) return;
            show({ ...pending, spelling: params });
        },
        close,
        edit(action) {
            if (!current) return false;
            callbacks.edit(action);
            return true;
        },
        update() {
            const request = current ?? pending;
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