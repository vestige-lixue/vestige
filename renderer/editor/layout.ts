import { Plugin } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";

type Layout = { version: number; listeners: Set<() => void> };
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

export function subscribeTranscriptLayout(view: EditorView, listener: () => void): () => void {
    const { listeners } = layoutOf(view);
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function invalidateTranscriptLayout(view: EditorView): void {
    const layout = layoutOf(view);
    layout.version++;
    for (const listener of layout.listeners) listener();
}

export function transcriptLayoutPlugin(): Plugin {
    return new Plugin({
        view(view) {
            invalidateTranscriptLayout(view);
            const observer = new ResizeObserver(() => invalidateTranscriptLayout(view));
            observer.observe(view.dom);
            // Showing the information bar can move a long transcript without resizing its content.
            const viewport = view.dom.closest(".transcript-scroll");
            if (viewport) observer.observe(viewport);
            return {
                update(view, previous) {
                    const state = view.state;
                    // Transcript decoration providers retain their sets across time-only playback ticks.
                    if (state.doc !== previous.doc || view.someProp("decorations", get => get(state) !== get(previous))) invalidateTranscriptLayout(view);
                },
                destroy: () => observer.disconnect()
            };
        }
    });
}