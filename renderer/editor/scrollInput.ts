import { type EditorView } from "@tiptap/pm/view";
import { subscribeTranscriptLayout } from "./layout";

type ScrollListener = (user: boolean) => void;
type ScrollInput = { listeners: Set<ScrollListener>; automatic: (top?: number) => void; destroy: () => void };
const inputs = new WeakMap<EditorView, ScrollInput>();
// Native momentum can outlast the last wheel event; each continuing scroll renews this interval.
const inputInterval = 200;

function createInput(view: EditorView, scroll: HTMLElement): ScrollInput {
    const document = view.dom.ownerDocument, window = document.defaultView!;
    const listeners = new Set<ScrollListener>(), events = new AbortController();
    const capture = { capture: true, signal: events.signal };
    let until = -Infinity, sequence = 0, scrollbar = false, middle = false, dragging = false;
    let middlePress: { x: number; y: number; moved: boolean } | undefined;
    let automatic: { sequence: number; until: number; top?: number } | undefined;
    function input(): void {
        sequence++;
        until = window.performance.now() + inputInterval;
    }
    function markAutomatic(top?: number): void {
        automatic = {
            sequence, until: window.performance.now() + inputInterval,
            top: top === undefined ? undefined : Math.max(0, Math.min(top, scroll.scrollHeight - scroll.clientHeight))
        };
    }
    scroll.addEventListener("wheel", input, { ...capture, passive: true });
    document.addEventListener("pointerdown", event => {
        scrollbar = false;
        dragging = event.button === 0 && event.target instanceof Node && view.dom.contains(event.target)
            && !event.ctrlKey && !event.metaKey && !event.altKey;
        if (dragging) until = -Infinity;
        if (event.button === 1 && event.target instanceof Node && scroll.contains(event.target)) {
            middle = !middle;
            middlePress = { x: event.clientX, y: event.clientY, moved: false };
            if (middle) input();
        }
        else {
            middle = false;
            middlePress = undefined;
            // The editor covers the scrollport's content; its own native scrollbar targets the scrollport.
            if (event.button === 0 && event.target === scroll) {
                scrollbar = true;
                input();
            }
        }
    }, capture);
    window.addEventListener("pointermove", event => {
        if (middlePress && event.buttons & 4 && Math.hypot(event.clientX - middlePress.x, event.clientY - middlePress.y) > 4) middlePress.moved = true;
    }, capture);
    window.addEventListener("pointerup", event => {
        if (event.button === 0) scrollbar = dragging = false;
        if (event.button === 1 && middlePress?.moved) middle = false;
        middlePress = undefined;
    }, capture);
    window.addEventListener("pointercancel", () => {
        scrollbar = middle = dragging = false;
        middlePress = undefined;
    }, capture);
    window.addEventListener("keydown", () => middle = false, capture);
    scroll.addEventListener("keydown", event => {
        if (event.isComposing || event.defaultPrevented || event.target instanceof Node && view.dom.contains(event.target)) return;
        if (["PageUp", "PageDown", " ", "Home", "End", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) input();
    }, capture);
    window.addEventListener("blur", () => {
        scrollbar = middle = dragging = false;
        until = -Infinity;
    }, { signal: events.signal });
    scroll.addEventListener("scroll", () => {
        const now = window.performance.now();
        const known = automatic && automatic.sequence === sequence && now <= automatic.until
            && (automatic.top === undefined || Math.abs(scroll.scrollTop - automatic.top) < 2);
        automatic = undefined;
        const user = !known && !dragging && (scrollbar || middle || now <= until);
        if (user) until = now + inputInterval;
        for (const listener of listeners) listener(user);
    }, { passive: true, signal: events.signal });
    // Content/size changes can move Chromium's scroll anchor without any scroll API call.
    const stopLayout = subscribeTranscriptLayout(view, reason => {
        if (reason !== "decorations") markAutomatic();
    });
    return {
        listeners, automatic: markAutomatic,
        destroy() {
            events.abort();
            stopLayout();
            inputs.delete(view);
        }
    };
}

/** Shared input ownership for inspection and break hints; the painting window still handles every scroll. */
export function subscribeTranscriptScroll(view: EditorView, listener: ScrollListener): () => void {
    const scroll = view.dom.closest<HTMLElement>(".transcript-scroll");
    if (!scroll) return () => {};
    let input = inputs.get(view);
    if (!input) {
        input = createInput(view, scroll);
        inputs.set(view, input);
    }
    input.listeners.add(listener);
    return () => {
        input.listeners.delete(listener);
        if (!input.listeners.size) input.destroy();
    };
}

/** A known write wins over an earlier wheel/key intent, but never over a newer user input. */
export function markAutomaticTranscriptScroll(view: EditorView, top: number): void {
    inputs.get(view)?.automatic(top);
}