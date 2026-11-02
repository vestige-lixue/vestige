import { Plugin } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
import { textRectangles } from "./geometry";

const topRatio = 0.2;
const bottomRatio = 0.8;

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

export function scrollTranscriptPosition(view: EditorView, position: number): boolean {
    return scrollTranscriptRect(view, view.coordsAtPos(position));
}

function transcriptRangeRect(view: EditorView, from: number, to: number, includeDeleted = false): { top: number; bottom: number } {
    const start = view.domAtPos(from, 1);
    const end = view.domAtPos(to, -1);
    const range = view.dom.ownerDocument.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    let top = Infinity;
    let bottom = -Infinity;
    // Caret coordinates at a text boundary can belong to a neighboring triangle instead of the text.
    for (const rect of textRectangles(view.dom, range, true, includeDeleted)) {
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.bottom);
    }
    return { top, bottom };
}

function scrollTranscriptSelection(view: EditorView): boolean {
    const { from, to, head, empty } = view.state.selection;
    if (!empty) {
        const rect = transcriptRangeRect(view, from, to, true);
        if (rect.top <= rect.bottom) return scrollTranscriptRect(view, rect);
    }
    return scrollTranscriptPosition(view, head);
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
    let pressed = false;
    let schedule = (): void => {};
    return new Plugin({
        props: {
            handleScrollToSelection(view) {
                if (pressed) return false;
                // Native input can scroll again after the transaction; settle before the next paint.
                schedule();
                return scrollTranscriptSelection(view);
            }
        },
        view(view) {
            const viewport = view.dom.closest<HTMLElement>(".transcript-scroll");
            if (!viewport) return {};
            const document = view.dom.ownerDocument;
            const window = document.defaultView!;
            const listeners = new AbortController();
            const capture = { signal: listeners.signal, capture: true };
            let frame = 0;
            let selectionChanged = false;
            schedule = () => {
                if (frame) return;
                frame = window.requestAnimationFrame(() => {
                    frame = 0;
                    if (!view.isDestroyed && view.hasFocus() && !pressed) {
                        scrollTranscriptSelection(view);
                    }
                });
            };
            function resize(): void {
                // Only the last line needs extra room; the first lines may stay above the follow interval.
                view.dom.style.setProperty("--transcript-scroll-padding", `${viewport!.clientHeight * (1 - bottomRatio)}px`);
                schedule();
            }
            function release(): void {
                if (!pressed) return;
                pressed = false;
                if (selectionChanged) schedule();
                selectionChanged = false;
            }
            view.dom.addEventListener("pointerdown", event => {
                if (event.isPrimary && event.button === 0) {
                    pressed = true;
                    selectionChanged = false;
                }
            }, capture);
            // Also follow a click on the existing caret, after native selection and handled audio links settle.
            view.dom.addEventListener("click", event => {
                if (event.button === 0 && !event.defaultPrevented) schedule();
            }, { signal: listeners.signal });
            document.addEventListener("pointerup", release, capture);
            document.addEventListener("pointercancel", release, capture);
            window.addEventListener("blur", release, capture);
            const observer = new ResizeObserver(resize);
            observer.observe(viewport);
            resize();
            return {
                update(view, previous) {
                    if (view.state.doc !== previous.doc || !view.state.selection.eq(previous.selection)) {
                        if (pressed) selectionChanged = true;
                        schedule();
                    }
                },
                destroy() {
                    window.cancelAnimationFrame(frame);
                    listeners.abort();
                    observer.disconnect();
                    view.dom.style.removeProperty("--transcript-scroll-padding");
                    schedule = () => {};
                }
            };
        }
    });
}