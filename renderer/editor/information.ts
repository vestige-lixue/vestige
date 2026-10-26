import { type Node as PMNode } from "@tiptap/pm/model";
import { Plugin, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { transcriptEvents, groupTranscriptEvents, type InspectionInformation } from "./informationModel";
import { type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { inspectionGeometry } from "./geometry";
import { inspectionController, type InspectionCallbacks } from "./interaction";
import { compositionPending } from "./composition";
import { firstTrue } from "../../shared/util/search";

export { type InspectionInformation } from "./informationModel";
export { type TranscriptInspection } from "./interaction";
export type InspectionOptions = InspectionCallbacks & { duration: number };
type PlaybackEvent = { start: number; end: number; key: string };

export function informationPlugin(index: TextIndex, projectionOf: (state: EditorState) => TextProjection, playbackOf: (state: EditorState) => number, options: InspectionOptions): Plugin {
    function build(doc: PMNode, projection: TextProjection): {
        byKey: Map<string, InspectionInformation>;
        decorations: DecorationSet;
        events: PlaybackEvent[];
        latestEnd: number[];
    } {
        const groups = groupTranscriptEvents(transcriptEvents(index, projection, options.duration));
        const byKey = new Map<string, InspectionInformation>();
        const events: PlaybackEvent[] = [];
        const decorations = [...groups].map(([position, information]) => {
            byKey.set(information.key, information);
            const items = information.kind === "events" ? information.items : [information];
            for (const item of items) {
                if (item.range) events.push({ ...item.range, key: information.key });
            }
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
        events.sort((left, right) => left.start - right.start);
        const latestEnd: number[] = [];
        for (const event of events) latestEnd.push(Math.max(latestEnd.at(-1) ?? -Infinity, event.end));
        return { byKey, decorations: DecorationSet.create(doc, decorations), events, latestEnd };
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
    const plugin: Plugin<DecorationSet> = new Plugin({
        state: {
            init: (_, state) => informationOf(state).decorations,
            apply: (transaction, decorations, _oldState, state) => compositionPending(state) ? decorations.map(transaction.mapping, transaction.doc)
                : informationOf(state).decorations
        },
        props: { decorations: state => plugin.getState(state) ?? DecorationSet.empty },
        view(view) {
            const current = new Map<string, SVGElement>();
            function updatePlayback(): void {
                if (compositionPending(view.state)) return;
                const time = playbackOf(view.state);
                const { events, latestEnd } = informationOf(view.state);
                const keys = new Set<string>();
                const first = firstTrue(events.length, index => events[index].start > time);
                // Separate deletions can share token times; grouped events can share one marker.
                for (let i = first - 1; i >= 0 && latestEnd[i] > time; i--) {
                    if (time < events[i].end) keys.add(events[i].key);
                }
                for (const [key, shape] of current) {
                    if (keys.has(key) && shape.isConnected) continue;
                    shape.classList.remove("current");
                    current.delete(key);
                }
                // Keep the focusable widget intact; playback outlines only its inner shape.
                for (const key of keys) {
                    if (current.has(key)) continue;
                    const shape = view.dom.querySelector<SVGElement>(`[data-inspection="${CSS.escape(key)}"] .transcript-event-shape`);
                    if (shape) {
                        shape.classList.add("current");
                        current.set(key, shape);
                    }
                }
            }
            updatePlayback();
            const geometry = inspectionGeometry(view, index, projectionOf, () => informationOf(view.state).byKey);
            const interaction = inspectionController(view, geometry, options);
            const observer = new ResizeObserver(interaction.refresh);
            observer.observe(view.dom);
            const listeners = new AbortController();
            const normal = { signal: listeners.signal };
            const capture = { ...normal, capture: true };
            view.dom.addEventListener("pointermove", interaction.move, normal);
            view.dom.addEventListener("pointerleave", interaction.leave, normal);
            view.dom.addEventListener("pointerdown", interaction.down, capture);
            view.dom.addEventListener("pointerup", interaction.move, capture);
            view.dom.addEventListener("click", interaction.click, capture);
            view.dom.addEventListener("pointercancel", interaction.leave, normal);
            view.dom.addEventListener("focusin", interaction.focus, capture);
            view.dom.addEventListener("focusout", interaction.blur, capture);
            window.addEventListener("keydown", interaction.modifiers, capture);
            window.addEventListener("keyup", interaction.modifiers, capture);
            window.addEventListener("blur", interaction.reset, normal);
            window.addEventListener("focus", interaction.refresh, normal);
            window.addEventListener("scroll", interaction.refresh, capture);
            return {
                update(_view, previous) {
                    updatePlayback();
                    interaction.update(previous);
                },
                destroy() {
                    listeners.abort();
                    observer.disconnect();
                    interaction.reset();
                }
            };
        }
    });
    return plugin;
}