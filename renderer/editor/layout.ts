import { Plugin } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";

export type TranscriptLayoutReason = "resize" | "document" | "decorations";
type Layout = { version: number; listeners: Set<(reason: TranscriptLayoutReason) => void> };
// Reconfiguring the plugins recreates their views. Subscriptions belong to the editor itself.
const layouts = new WeakMap<EditorView, Layout>();

function layoutOf(view: EditorView): Layout {
    let layout = layouts.get(view);
    if (!layout) {
        layout = { version: 0, listeners: new Set() };
        layouts.set(view, layout);
    }
    return layout;
}

export function transcriptLayoutVersion(view: EditorView): number {
    return layoutOf(view).version;
}

export function subscribeTranscriptLayout(view: EditorView, listener: (reason: TranscriptLayoutReason) => void): () => void {
    const { listeners } = layoutOf(view);
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function invalidateTranscriptLayout(view: EditorView, reason: TranscriptLayoutReason = "resize"): void {
    const layout = layoutOf(view);
    layout.version++;
    for (const listener of layout.listeners) listener(reason);
}

export function transcriptLayoutPlugin(): Plugin {
    return new Plugin({
        view(view) {
            invalidateTranscriptLayout(view);
            let measuredDocument = view.state.doc;
            const sizes = new Map<Element, { width: number; height: number }>();
            const observer = new ResizeObserver(entries => {
                let resized = false;
                for (const entry of entries) {
                    const previous = sizes.get(entry.target), { width, height } = entry.contentRect;
                    // Content edits change the paragraph's height without changing its wrapping width.
                    if (!previous || entry.target !== view.dom || previous.width !== width || measuredDocument === view.state.doc) resized = true;
                    sizes.set(entry.target, { width, height });
                }
                measuredDocument = view.state.doc;
                invalidateTranscriptLayout(view, resized ? "resize" : "document");
            });
            observer.observe(view.dom);
            // Showing the information bar can move a long transcript without resizing its content.
            const viewport = view.dom.closest(".transcript-scroll");
            if (viewport) observer.observe(viewport);
            return {
                update(view, previous) {
                    const state = view.state;
                    // Transcript decoration providers retain their sets across time-only playback ticks.
                    if (state.doc !== previous.doc) invalidateTranscriptLayout(view, "document");
                    else if (view.someProp("decorations", get => get(state) !== get(previous))) invalidateTranscriptLayout(view, "decorations");
                },
                destroy: () => observer.disconnect()
            };
        }
    });
}