import { Plugin, type EditorState, type Transaction } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
import { textRectangles } from "./geometry";

const topRatio = 0.2;
const bottomRatio = 0.8;
const navigationKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

function scrollTranscriptRect(view: EditorView, rect: { top: number; bottom: number }): boolean {
    const viewport = view.dom.closest<HTMLElement>(".transcript-scroll");
    if (!viewport || !viewport.clientHeight) return false;
    const origin = viewport.getBoundingClientRect().top + viewport.clientTop;
    const top = origin + viewport.clientHeight * topRatio;
    const bottom = origin + viewport.clientHeight * bottomRatio;
    // When both edges cannot fit, keep the first line in the interval and let the last line overflow.
    const offset = rect.top < top || rect.bottom - rect.top > bottom - top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0;
    // Smooth scrolling restarts on every repeated key and can never catch up with the caret.
    if (offset) viewport.scrollTo({ top: viewport.scrollTop + offset, behavior: "instant" });
    return true;
}

export function scrollTranscriptSelectionHead(view: EditorView): void {
    scrollTranscriptRect(view, view.coordsAtPos(view.state.selection.head));
}

export function dispatchPreservingScroll(view: EditorView, transaction: Transaction): void {
    const viewport = view.dom.closest<HTMLElement>(".transcript-scroll");
    const top = viewport?.scrollTop ?? 0;
    view.dispatch(transaction);
    // Read after layout so an explicit write can undo just this transaction's anchor adjustment.
    if (viewport && viewport.scrollTop !== top) viewport.scrollTo({ top, behavior: "instant" });
}

function transcriptRangeRect(view: EditorView, from: number, to: number): { top: number; bottom: number } {
    const start = view.domAtPos(from, 1);
    const end = view.domAtPos(to, -1);
    const range = view.dom.ownerDocument.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    let top = Infinity;
    let bottom = -Infinity;
    // Caret coordinates at a text boundary can belong to a neighboring triangle instead of the text.
    for (const rect of textRectangles(view.dom, range, true)) {
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.bottom);
    }
    return { top, bottom };
}

export function scrollTranscriptPlayback(view: EditorView, ranges: readonly number[], markers: readonly HTMLElement[]): boolean {
    let top = Infinity;
    let bottom = -Infinity;
    if (ranges.length) {
        let from = Infinity;
        let to = -Infinity;
        for (let i = 0; i < ranges.length; i += 2) {
            from = Math.min(from, ranges[i]);
            to = Math.max(to, ranges[i + 1]);
        }
        // Playback intervals are ordered by time, so their first entry need not be the first rendered line.
        ({ top, bottom } = transcriptRangeRect(view, from, to));
    }
    for (const marker of markers) {
        const anchor = marker.closest(".transcript-event-anchor");
        if (!anchor) continue;
        const rect = marker.getBoundingClientRect();
        const lineTop = anchor.getBoundingClientRect().top;
        const lineHeight = parseFloat(getComputedStyle(view.dom.firstElementChild ?? view.dom).lineHeight) || rect.height;
        // Expanded deletion previews can put markers on different lines at the same editor position.
        top = Math.min(top, rect.top, lineTop);
        bottom = Math.max(bottom, rect.bottom, lineTop + lineHeight);
    }
    return top <= bottom && scrollTranscriptRect(view, { top, bottom });
}

export function transcriptScrollPlugin(): Plugin {
    return new Plugin({
        props: {
            // ProseMirror also requests scrolling when repairing focus or applying commands.
            // Direct input and history commands handle caret scrolling explicitly.
            handleScrollToSelection: view => !!view.dom.closest(".transcript-scroll")
        },
        view(view) {
            const viewport = view.dom.closest<HTMLElement>(".transcript-scroll");
            if (!viewport) return {};
            const document = view.dom.ownerDocument;
            const window = document.defaultView!;
            const listeners = new AbortController();
            const capture = { signal: listeners.signal, capture: true };
            let frame = 0;
            function cancel(): void {
                window.cancelAnimationFrame(frame);
                frame = 0;
            }
            function followCaret(before?: EditorState): void {
                cancel();
                frame = window.requestAnimationFrame(() => {
                    frame = 0;
                    const selection = document.getSelection();
                    if (!view.hasFocus() || !selection?.isCollapsed || !selection.focusNode || !view.dom.contains(selection.focusNode)) return;
                    // Native navigation can move the DOM caret before ProseMirror receives selectionchange.
                    const head = view.posAtDOM(selection.focusNode, selection.focusOffset);
                    if (before && before.doc === view.state.doc && before.selection.empty && before.selection.head === head) return;
                    scrollTranscriptRect(view, view.coordsAtPos(head));
                });
            }
            function resize(): void {
                // Only the last line needs extra room; the first lines may stay above the follow interval.
                view.dom.style.setProperty("--transcript-scroll-padding", `${viewport!.clientHeight * (1 - bottomRatio)}px`);
            }
            function edit(): void {
                if (view.editable) followCaret(view.state);
            }
            view.dom.addEventListener("keydown", event => {
                cancel();
                if (event.target !== view.dom || event.defaultPrevented || event.isComposing) return;
                if (!event.shiftKey && navigationKeys.has(event.key)) followCaret(view.state);
                // Key bindings can apply these edits before Chromium emits beforeinput.
                else if (event.key === "Enter" || event.key === "Backspace" || event.key === "Delete") edit();
            }, capture);
            for (const type of ["beforeinput", "cut", "paste", "drop"]) view.dom.addEventListener(type, edit, capture);
            view.dom.addEventListener("click", event => {
                if (event.detail !== 1 || event.button !== 0 || event.defaultPrevented || event.shiftKey || event.ctrlKey || event.metaKey) return;
                if (event.target instanceof Element && event.target.closest(".transcript-event-anchor, .transcript-deletion-expanded")) return;
                followCaret();
            }, { signal: listeners.signal });
            document.addEventListener("pointerdown", cancel, capture);
            viewport.addEventListener("wheel", cancel, { ...capture, passive: true });
            view.dom.addEventListener("focusout", cancel, capture);
            window.addEventListener("blur", cancel, { signal: listeners.signal });
            const observer = new ResizeObserver(resize);
            observer.observe(viewport);
            resize();
            return {
                destroy() {
                    cancel();
                    listeners.abort();
                    observer.disconnect();
                    view.dom.style.removeProperty("--transcript-scroll-padding");
                }
            };
        }
    });
}