import { type Editor, type EditorEvents } from "@tiptap/core";
import { type EditorView } from "@tiptap/pm/view";
import { Mapping } from "@tiptap/pm/transform";
import { bufferTextWindow, mapTextWindow, type TextWindow } from "../../shared/transcript/find";
import { subscribeTranscriptLayout } from "./layout";
import { compositionPending } from "./composition";
import * as modal from "../states/modal.svelte";

type Viewport = {
    window: TextWindow;
    valid: boolean;
    fallback: "missing-scroll" | "not-visible" | "hit-test" | "occluded" | null;
    users: number;
    listeners: Set<() => void>;
    refresh?: () => void;
    anchor?: (position: number) => void;
};
const viewports = new WeakMap<EditorView, Viewport>();
export const transcriptScrollIdleDelay = 100;

function viewportOf(view: EditorView): Viewport {
    let viewport = viewports.get(view);
    if (!viewport) {
        viewport = { window: { from: 0, to: 0 }, valid: false, fallback: null, users: 0, listeners: new Set() };
        viewports.set(view, viewport);
    }
    return viewport;
}

/** Cached only: selection changes must not cause layout or coordinate hit tests. */
export function transcriptViewport(view: EditorView): TextWindow {
    return viewportOf(view).window;
}

/** Last failed measurement; retain the cached window, or an empty window before the first success. */
export function transcriptViewportFallback(view: EditorView): Viewport["fallback"] {
    return viewportOf(view).fallback;
}

/** A programmatic scroll already knows its PM target; reuse the measured screen span instead of hit-testing it again. */
export function anchorTranscriptViewport(view: EditorView, position: number): void {
    viewportOf(view).anchor?.(position);
}

export function subscribeTranscriptViewport(view: EditorView, listener: () => void): { setNeeded: (needed: boolean) => void; unsubscribe: () => void } {
    const viewport = viewportOf(view);
    let needed = false;
    viewport.listeners.add(listener);
    function setNeeded(value: boolean): void {
        if (value === needed) return;
        needed = value;
        viewport.users += value ? 1 : -1;
        if (value) viewport.refresh?.();
    }
    return {
        setNeeded,
        unsubscribe() {
            setNeeded(false);
            viewport.listeners.delete(listener);
        }
    };
}

// Owned by the editor, rather than a plugin view recreated on plugin reconfiguration.
export function trackTranscriptViewport(editor: Editor): () => void {
    const view = editor.view, viewport = viewportOf(view);
    const scroll = view.dom.closest<HTMLElement>(".transcript-scroll");
    const owner = view.dom.ownerDocument.defaultView!;
    let document = view.state.doc;
    let frame = 0, dirty = true, boundsDirty = false, changed = false, didScroll = false;
    let visibleSize = 0;
    let composing = view.composing || compositionPending(view.state);
    let blocked = modal.hasBlockingLayer();
    let bounds: { top: number; bottom: number; height: number } | null = null;

    function publish(next: TextWindow): void {
        if (next.from === viewport.window.from && next.to === viewport.window.to) return;
        viewport.window = next;
        changed = true;
    }
    function updateBounds(): void {
        boundsDirty = false;
        if (!scroll || !viewport.valid) return;
        const length = view.state.doc.firstChild!.content.size;
        const rect = scroll.getBoundingClientRect(), origin = rect.top + scroll.clientTop - scroll.scrollTop;
        const margin = scroll.clientHeight / 3, { from, to } = viewport.window;
        bounds = {
            top: from ? view.coordsAtPos(from + 1).top - origin + margin : -Infinity,
            bottom: to < length ? view.coordsAtPos(to + 1).bottom - origin - margin : Infinity,
            height: scroll.clientHeight
        };
    }
    function measure(): void {
        dirty = false;
        boundsDirty = false;
        bounds = null;
        if (!scroll) {
            // A missing container is a wiring error, separate from runtime occlusion or hit-test failures.
            viewport.fallback = "missing-scroll";
            publish({ from: 0, to: view.state.doc.firstChild!.content.size });
            return;
        }
        const length = view.state.doc.firstChild!.content.size;
        const rect = scroll.getBoundingClientRect(), editor = view.dom.getBoundingClientRect();
        const style = owner.getComputedStyle(view.dom);
        const left = Math.max(0, rect.left + scroll.clientLeft, editor.left + parseFloat(style.paddingLeft));
        const right = Math.min(owner.innerWidth, rect.left + scroll.clientLeft + scroll.clientWidth, editor.right - parseFloat(style.paddingRight));
        const top = Math.max(0, rect.top + scroll.clientTop, editor.top + parseFloat(style.paddingTop));
        const bottom = Math.min(owner.innerHeight, rect.top + scroll.clientTop + scroll.clientHeight, editor.bottom - parseFloat(style.paddingBottom));
        if (right <= left || bottom <= top) {
            viewport.fallback = "not-visible";
            return;
        }
        function position(end: boolean): number | null {
            for (const inset of [2, 8, 24, 48]) {
                const x = Math.min(inset, (right - left) / 2), y = Math.min(inset, (bottom - top) / 2);
                const hit = view.posAtCoords({ left: end ? right - x : left + x, top: end ? bottom - y : top + y });
                if (hit) return Math.max(0, Math.min(length, hit.pos - 1));
            }
            return null;
        }
        const from = length ? position(false) : 0, to = length ? position(true) : 0;
        if (from === null || to === null) {
            viewport.fallback = "hit-test";
            return;
        }
        viewport.fallback = null;
        viewport.valid = true;
        visibleSize = Math.max(1, Math.abs(to - from));
        publish(bufferTextWindow({ from: Math.min(from, to), to: Math.max(from, to) }, length));
        updateBounds();
    }
    function refresh(): void {
        frame = 0;
        if (view.isDestroyed) return;
        if (!viewport.users) {
            dirty = true;
            return;
        }
        if (modal.hasBlockingLayer()) {
            // Modal's full-window mask is authoritative; uncached elementFromPoint is expensive too.
            viewport.fallback = "occluded";
            if (boundsDirty && !view.composing && !compositionPending(view.state)) updateBounds();
            dirty = false;
            didScroll = false;
        }
        else if (!view.composing && !compositionPending(view.state)) {
            if (dirty || !viewport.valid) measure();
            else if (boundsDirty) {
                updateBounds();
                if (didScroll && bounds && scroll && (scroll.scrollTop < bounds.top || scroll.scrollTop + scroll.clientHeight > bounds.bottom)) measure();
            }
            else if (!bounds || !scroll || bounds.height !== scroll.clientHeight || scroll.scrollTop < bounds.top || scroll.scrollTop + scroll.clientHeight > bounds.bottom) measure();
            didScroll = false;
        }
        // Notify after every transaction listener has consumed the new document and its mapped offsets.
        if (changed) {
            changed = false;
            for (const listener of viewport.listeners) listener();
        }
    }
    function schedule(): void {
        if (viewport.users && !frame) frame = owner.requestAnimationFrame(refresh);
    }
    viewport.refresh = schedule;
    viewport.anchor = position => {
        if (!viewport.users || !viewport.valid || dirty || view.composing || compositionPending(view.state)) return;
        const length = view.state.doc.firstChild!.content.size;
        const from = Math.max(0, Math.min(Math.max(0, length - visibleSize), Math.floor(position - 1 - visibleSize / 2)));
        publish(bufferTextWindow({ from, to: Math.min(length, from + visibleSize) }, length));
        boundsDirty = true;
        schedule();
    };
    function update({ transaction, appendedTransactions }: EditorEvents["transaction"]): void {
        const nextComposing = view.composing || compositionPending(view.state);
        if (document !== view.state.doc) {
            const mapping = new Mapping();
            for (const tr of [transaction, ...appendedTransactions]) mapping.appendMapping(tr.mapping);
            if (viewport.valid) {
                const length = view.state.doc.firstChild!.content.size, previous = viewport.window;
                const next = mapTextWindow(previous, length, (pos, assoc) => mapping.map(pos, assoc));
                const growth = Math.max(0, length - document.firstChild!.content.size);
                // A broad projection replacement can send a clipped edge to its far end. That is
                // not a local window mapping: retire it like a new document instead of painting all text.
                const replacedEdge = mapping.mapResult(previous.from + 1, -1).deletedAcross || mapping.mapResult(previous.to + 1, 1).deletedAcross;
                if (replacedEdge && next.to - next.from > previous.to - previous.from + growth) {
                    viewport.valid = false;
                    dirty = true;
                    publish({ from: 0, to: 0 });
                }
                else publish(next);
            }
            document = view.state.doc;
            bounds = null;
            boundsDirty = true;
            schedule();
        }
        else if (composing && !nextComposing) schedule();
        composing = nextComposing;
    }
    const unsubscribe = subscribeTranscriptLayout(view, reason => {
        if (reason === "decorations") return;
        if (reason === "resize") dirty = true;
        else boundsDirty = true;
        schedule();
    });
    const stopModal = modal.subscribeModalLayers(() => {
        const next = modal.hasBlockingLayer();
        if (next === blocked) return;
        blocked = next;
        dirty = true;
        schedule();
    });
    function scrolled(): void {
        didScroll = true;
        if (!viewport.users) dirty = true;
        schedule();
    }
    editor.on("transaction", update);
    scroll?.addEventListener("scroll", scrolled, { passive: true });
    return () => {
        owner.cancelAnimationFrame(frame);
        unsubscribe();
        stopModal();
        editor.off("transaction", update);
        scroll?.removeEventListener("scroll", scrolled);
        viewport.refresh = undefined;
        viewport.anchor = undefined;
        viewport.listeners.clear();
        viewports.delete(view);
    };
}