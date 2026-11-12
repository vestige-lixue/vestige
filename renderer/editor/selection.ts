import { type Editor, type EditorEvents } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { intersectTextWindow } from "../../shared/transcript/find";
import { subscribeTranscriptLayout } from "./layout";
import { transcriptViewport, subscribeTranscriptViewport } from "./viewport";
import { restoreTranscriptDOMSelection, transcriptPreviewOriginal, transcriptPreviewSelection, transcriptPreviewBoundary, transcriptPreviewPoint, type TranscriptPreviewPoint } from "./selectionDOM";

type Endpoints = { startContainer: Node; startOffset: number; endContainer: Node; endOffset: number };
type PaintedRange = Endpoints & { range: StaticRange; startText: string | null; endText: string | null };
type Bounds = { from: number; to: number };

export function attachTranscriptSelection(editor: Editor, boundsChanged: (bounds: Bounds | null) => void): () => void {
    const view = editor.view, document = view.dom.ownerDocument;
    const name = "transcript-selection", previewName = "transcript-deletion-selection";
    const highlight = new Highlight(), previewHighlight = new Highlight();
    highlight.priority = previewHighlight.priority = 1;
    CSS.highlights.set(name, highlight);
    CSS.highlights.set(previewName, previewHighlight);
    let painted: PaintedRange | null = null;
    let previewPainted: PaintedRange | null = null;
    let bounds: Bounds | null = null;
    let dragging: { original: HTMLElement; pointer: number; anchor: TranscriptPreviewPoint; x: number; y: number; whole: boolean } | null = null;
    let dragFrame = 0;
    let bodyPointer: number | null = null;
    let bodyFrame = 0;
    const owner = document.defaultView!;
    const listeners = new AbortController();
    const capture = { capture: true, signal: listeners.signal };

    function collapsePreviewSelection(original: HTMLElement): void {
        if (view.state.selection.empty) return;
        const position = view.posAtDOM(original, 0);
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)).setMeta("addToHistory", false));
    }

    function selectPreview(anchor: TranscriptPreviewPoint, head: TranscriptPreviewPoint): void {
        document.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, head.node, head.offset);
        fromDOM();
    }

    function finishDrag(): void {
        owner.cancelAnimationFrame(bodyFrame);
        bodyFrame = 0;
        bodyPointer = null;
        owner.cancelAnimationFrame(dragFrame);
        dragFrame = 0;
        const previous = dragging;
        dragging = null;
        if (previous?.original.hasPointerCapture(previous.pointer)) previous.original.releasePointerCapture(previous.pointer);
    }

    function movePreview(): void {
        dragFrame = 0;
        if (!dragging) return;
        if (!view.dom.contains(dragging.original)) return finishDrag();
        const head = dragging.whole ? transcriptPreviewBoundary(dragging.original, true)
            : transcriptPreviewPoint(dragging.original, dragging.x, dragging.y);
        if (head) selectPreview(dragging.anchor, head);
    }

    function selectablePreview(event: MouseEvent): HTMLElement | null {
        if (event.button !== 0 || event.ctrlKey || event.metaKey) return null;
        const target = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
        return target?.closest(".transcript-event") ? null : transcriptPreviewOriginal(view, event.target);
    }

    function followBodySelection(): void {
        bodyFrame = 0;
        if (bodyPointer === null) return;
        // Native autoscroll can advance between selectionchange deliveries. Read its endpoints each drag frame.
        fromDOM();
        bodyFrame = owner.requestAnimationFrame(followBodySelection);
    }

    view.dom.addEventListener("pointerdown", event => {
        if (!event.isPrimary || event.button !== 0 || event.ctrlKey || event.metaKey || view.composing) return;
        finishDrag();
        const original = selectablePreview(event);
        if (!original) {
            const target = event.target instanceof Element ? event.target : null;
            if (!transcriptPreviewOriginal(view, target) && !target?.closest(".transcript-event")) {
                bodyPointer = event.pointerId;
                bodyFrame = owner.requestAnimationFrame(followBodySelection);
            }
            return;
        }
        const whole = event.detail >= 2;
        const anchor = whole ? transcriptPreviewBoundary(original, false) : transcriptPreviewPoint(original, event.clientX, event.clientY);
        if (!anchor) return;
        event.preventDefault();
        finishDrag();
        dragging = { original, pointer: event.pointerId, anchor, x: event.clientX, y: event.clientY, whole };
        original.setPointerCapture(event.pointerId);
        original.focus({ preventScroll: true });
        // Collapse once, before taking ownership of the DOM endpoints. Selectionchange only paints while held.
        collapsePreviewSelection(original);
        movePreview();
    }, capture);
    owner.addEventListener("pointermove", event => {
        if (event.pointerId === bodyPointer && !(event.buttons & 1)) finishDrag();
        if (!dragging || event.pointerId !== dragging.pointer) return;
        if (!(event.buttons & 1)) return finishDrag();
        event.preventDefault();
        dragging.x = event.clientX;
        dragging.y = event.clientY;
        if (!dragFrame) dragFrame = owner.requestAnimationFrame(movePreview);
    }, capture);
    owner.addEventListener("pointerup", event => {
        if (event.pointerId === bodyPointer) finishDrag();
        if (!dragging || event.pointerId !== dragging.pointer) return;
        dragging.x = event.clientX;
        dragging.y = event.clientY;
        owner.cancelAnimationFrame(dragFrame);
        movePreview();
        finishDrag();
    }, capture);
    owner.addEventListener("pointercancel", event => {
        if (event.pointerId === dragging?.pointer || event.pointerId === bodyPointer) finishDrag();
    }, capture);
    view.dom.addEventListener("lostpointercapture", event => {
        if (event.pointerId === dragging?.pointer) finishDrag();
    }, capture);
    owner.addEventListener("blur", finishDrag, { signal: listeners.signal });
    view.dom.addEventListener("focusout", event => {
        if (!(event.relatedTarget instanceof Node) || !view.dom.contains(event.relatedTarget)) finishDrag();
    }, capture);
    view.dom.addEventListener("click", event => {
        const original = event.detail >= 2 ? selectablePreview(event) : null;
        if (!original) return;
        const start = transcriptPreviewBoundary(original, false), end = transcriptPreviewBoundary(original, true);
        if (!start || !end) return;
        event.preventDefault();
        collapsePreviewSelection(original);
        selectPreview(start, end);
    }, capture);

    function paintRange(highlight: Highlight, previous: PaintedRange | null, next: Endpoints | null): PaintedRange | null {
        const data = (node: Node): string | null => node instanceof Text ? node.data : null;
        if (next && previous?.startContainer === next.startContainer && previous.startOffset === next.startOffset
            && previous.endContainer === next.endContainer && previous.endOffset === next.endOffset
            && previous.startText === data(next.startContainer) && previous.endText === data(next.endContainer)) return previous;
        if (previous) highlight.delete(previous.range);
        if (!next) return null;
        // Static endpoints do not migrate when ProseMirror replaces text or widgets.
        const range = new StaticRange(next);
        highlight.add(range);
        return { ...next, range, startText: data(next.startContainer), endText: data(next.endContainer) };
    }

    function paintBounds(next: Bounds | null): void {
        if (bounds?.from !== next?.from || bounds?.to !== next?.to) boundsChanged(next);
        bounds = next;
    }

    function paint(from: number, to: number, native?: Range): void {
        viewport.setNeeded(from < to);
        previewPainted = paintRange(previewHighlight, previewPainted, null);
        const clipped = intersectTextWindow({ from: from - 1, to: to - 1 }, transcriptViewport(view));
        if (!clipped) {
            painted = paintRange(highlight, painted, null);
            return paintBounds(null);
        }
        const mirror = native && clipped.from === from - 1 && clipped.to === to - 1;
        const start = mirror ? { node: native.startContainer, offset: native.startOffset } : view.domAtPos(clipped.from + 1, 1);
        const end = mirror ? { node: native.endContainer, offset: native.endOffset } : view.domAtPos(clipped.to + 1, -1);
        // CSS keeps this one bounded body range transparent inside deletion islands.
        painted = paintRange(highlight, painted, { startContainer: start.node, startOffset: start.offset, endContainer: end.node, endOffset: end.offset });
        paintBounds({ from: clipped.from + 1, to: clipped.to + 1 });
    }

    function paintPreview(range: Range): void {
        viewport.setNeeded(true);
        painted = paintRange(highlight, painted, null);
        paintBounds(null);
        const window = transcriptViewport(view), original = transcriptPreviewOriginal(view, range.startContainer)!;
        const position = view.posAtDOM(original, 0) - 1;
        previewPainted = paintRange(previewHighlight, previewPainted, !range.collapsed && position >= window.from && position <= window.to ? {
            startContainer: range.startContainer, startOffset: range.startOffset, endContainer: range.endContainer, endOffset: range.endOffset
        } : null);
    }

    function fromState(): void {
        const { from, to, empty } = view.state.selection;
        const preview = empty && transcriptPreviewSelection(view);
        if (preview) paintPreview(preview);
        else paint(from, to);
    }

    function fromDOM(): void {
        const selection = document.getSelection(), range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (!range) {
            if (!dragging) fromState();
            return;
        }
        const start = transcriptPreviewOriginal(view, range.startContainer), end = transcriptPreviewOriginal(view, range.endContainer);
        if (dragging) {
            // The captured pointer owns both endpoints, including the collapsed press. Never repair them here.
            if (start === dragging.original && end === dragging.original) paintPreview(range);
            return;
        }
        if (start || end) {
            if (start !== end) {
                restoreTranscriptDOMSelection(view);
                return fromState();
            }
            if (!range.collapsed) {
                if (!view.state.selection.empty) {
                    const saved = new StaticRange(range);
                    const position = view.posAtDOM(start!, 0);
                    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)).setMeta("addToHistory", false));
                    selection!.setBaseAndExtent(saved.startContainer, saved.startOffset, saved.endContainer, saved.endOffset);
                }
                return paintPreview(selection!.getRangeAt(0));
            }
        }
        if (!view.hasFocus() || !view.dom.contains(range.startContainer) || !view.dom.contains(range.endContainer)) return fromState();
        if (range.collapsed) return paint(0, 0);
        // Chromium moves before ProseMirror during a native drag. Paint synchronously from its mapped endpoints.
        paint(view.posAtDOM(range.startContainer, range.startOffset, 1), view.posAtDOM(range.endContainer, range.endOffset, -1), range);
    }

    function redraw(): void {
        if (dragging) return fromDOM();
        const selection = document.getSelection(), range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (view.hasFocus() && range && view.dom.contains(range.startContainer) && view.dom.contains(range.endContainer)) fromDOM();
        else fromState();
    }

    function update({ transaction, appendedTransactions }: EditorEvents["transaction"]): void {
        if (transaction.docChanged || transaction.selectionSet || appendedTransactions.some(tr => tr.docChanged || tr.selectionSet)) redraw();
    }
    const unsubscribe = subscribeTranscriptLayout(view, redraw);
    const viewport = subscribeTranscriptViewport(view, redraw);
    editor.on("transaction", update);
    // Repair mixed native ranges before ProseMirror's bubbling selectionchange observer reads them.
    document.addEventListener("selectionchange", fromDOM, true);
    fromState();
    return () => {
        finishDrag();
        listeners.abort();
        unsubscribe();
        viewport.unsubscribe();
        editor.off("transaction", update);
        document.removeEventListener("selectionchange", fromDOM, true);
        if (CSS.highlights.get(name) === highlight) CSS.highlights.delete(name);
        if (CSS.highlights.get(previewName) === previewHighlight) CSS.highlights.delete(previewName);
        boundsChanged(null);
    };
}