import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { transcriptEvents, transcriptSelectionUnits, type TranscriptInformation } from "./informationModel";
import { type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { inspectionGeometry } from "./geometry";
import { inspectionController, type InspectionCallbacks } from "./interaction";
import { compositionPending } from "./composition";
import { firstTrue } from "../../shared/util/search";
import { previewUnits, renderPreview } from "./preview";
import { transcriptMarker, transcriptMarkerAnchor } from "./markers";

export { type InspectionInformation } from "./informationModel";
export { type TranscriptInspection } from "./interaction";
export type InspectionLabels = { expand: string; collapse: string };
export type InspectionOptions = InspectionCallbacks & { duration: number; labels?: InspectionLabels };
type SourceRange = { from: number; to: number };
type PlaybackEvent = { start: number; end: number; key: string; parentKey?: string };
type InformationModel = { information: TranscriptInformation[]; byKey: Map<string, TranscriptInformation>; events: PlaybackEvent[]; latestEnd: number[] };
type InformationState = InformationModel & {
    decorations: DecorationSet;
    projection: TextProjection;
    expanded: SourceRange[];
    labels: InspectionLabels;
    pending: boolean;
};
type InformationAction = { ranges?: SourceRange[]; selection?: boolean; labels?: InspectionLabels; refresh?: boolean };
const informationKey = new PluginKey<InformationState>("vestigeInformation");

export function refreshTranscriptInformation(view: EditorView, labels: InspectionLabels): void {
    if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(informationKey, { labels, refresh: true } satisfies InformationAction).setMeta("addToHistory", false));
}

export function toggleSelectionDeletions(view: EditorView): boolean {
    if (!informationKey.getState(view.state) || view.state.selection.empty || view.composing || compositionPending(view.state)) return false;
    view.dispatch(view.state.tr.setMeta(informationKey, { selection: true } satisfies InformationAction).setMeta("addToHistory", false));
    return true;
}

export function informationPlugin(index: TextIndex, projectionOf: (state: EditorState) => TextProjection, playbackOf: (state: EditorState) => number, options: InspectionOptions): Plugin {
    const cache = new WeakMap<TextProjection, InformationModel>();
    function modelOf(projection: TextProjection): InformationModel {
        const previous = cache.get(projection);
        if (previous) return previous;
        const information = transcriptEvents(index, projection, options.duration);
        const byKey = new Map<string, TranscriptInformation>();
        const events: PlaybackEvent[] = [];
        for (const item of information) {
            for (const event of [item, ...item.gaps ?? []]) {
                byKey.set(event.key, event);
                if (event.range) events.push({ ...event.range, key: event.key, parentKey: event === item ? undefined : item.key });
            }
        }
        events.sort((left, right) => left.start - right.start);
        const latestEnd: number[] = [];
        for (const event of events) latestEnd.push(Math.max(latestEnd.at(-1) ?? -Infinity, event.end));
        const model = { information, byKey, events, latestEnd };
        cache.set(projection, model);
        return model;
    }
    function isExpanded(expanded: SourceRange[], item: TranscriptInformation): boolean {
        return expanded.some(range => range.from < item.sourceTo && item.sourceFrom < range.to);
    }
    function build(state: EditorState, expanded: SourceRange[], labels: InspectionLabels): InformationState {
        const projection = projectionOf(state);
        const model = modelOf(projection);
        const decorations = model.information.map(information => {
            const position = information.from;
            const open = information.kind === "deletion" && isExpanded(expanded, information);
            // Keep the default end-of-document caret inside the last text node.
            const side = position === state.doc.firstChild!.content.size ? 1 : -1;
            const key = `${side}/${information.key}/${information.sourceFrom}-${information.sourceTo}/${open}/${JSON.stringify(labels)}/${open ? information.gaps?.map(gap => gap.key).join(",") : ""}`;
            let dom: HTMLElement | undefined;
            return Decoration.widget(position + 1, () => {
                // Mapping during composition can redraw a widget; retain its original DOM.
                if (dom) return dom;
                const anchor = transcriptMarkerAnchor(transcriptMarker(information, { expanded: open, label: open ? labels.collapse : labels.expand }));
                if (!open) return dom = anchor;
                const expanded = document.createElement("span");
                expanded.className = "transcript-deletion-expanded";
                expanded.contentEditable = "false";
                expanded.spellcheck = false;
                expanded.append(anchor);
                const original = document.createElement("span");
                original.className = "transcript-deletion-original";
                original.tabIndex = -1;
                renderPreview(original, previewUnits(information.original!, "deleted", information.gaps, information.sourceFrom), {
                    gap: gap => transcriptMarkerAnchor(transcriptMarker(gap))
                });
                expanded.append(original);
                return dom = expanded;
            }, { key, side, relaxedSide: true, marks: [], ignoreSelection: true, stopEvent: () => true });
        });
        return { ...model, projection, expanded, labels, pending: false, decorations: DecorationSet.create(state.doc, decorations) };
    }
    const plugin = new Plugin<InformationState>({
        key: informationKey,
        state: {
            init: (_, state) => build(state, [], options.labels ?? { expand: "Expand deletion", collapse: "Collapse deletion" }),
            apply(transaction, previous, _oldState, state) {
                const action = transaction.getMeta(informationKey) as InformationAction | undefined;
                const labels = action?.labels ?? previous.labels;
                if (compositionPending(state)) return { ...previous, pending: true, labels, decorations: previous.decorations.map(transaction.mapping, transaction.doc) };
                const projection = projectionOf(state);
                if (!action && !previous.pending && previous.projection === projection) return previous;
                const model = modelOf(projection);
                let expanded = model.information.filter(item => item.kind === "deletion" && isExpanded(previous.expanded, item))
                    .map(item => ({ from: item.sourceFrom, to: item.sourceTo }));
                const ranges = action?.selection
                    ? transcriptSelectionUnits(index, projection, options.duration, state.selection.from - 1, state.selection.to - 1).deletions.map(item => ({ from: item.sourceFrom, to: item.sourceTo }))
                    : action?.ranges;
                if (ranges?.length) {
                    const contains = (range: SourceRange, values: SourceRange[]): boolean => values.some(item => item.from === range.from && item.to === range.to);
                    const open = ranges.some(range => !contains(range, expanded));
                    expanded = [...expanded.filter(range => !contains(range, ranges)), ...open ? ranges : []];
                }
                return build(state, expanded, labels);
            }
        },
        props: { decorations: state => informationKey.getState(state)?.decorations ?? DecorationSet.empty },
        view(view) {
            const current = new Map<string, SVGElement>();
            let pressed: HTMLElement | null = null;
            function release(): void {
                pressed?.classList.remove("pressed");
                pressed = null;
            }
            function updatePlayback(): void {
                if (compositionPending(view.state)) return;
                const time = playbackOf(view.state);
                const { events, latestEnd } = informationKey.getState(view.state)!;
                const keys = new Set<string>();
                const first = firstTrue(events.length, index => events[index].start > time);
                // Separate deletions can share token times; absorbed gaps highlight their deletion marker.
                for (let i = first - 1; i >= 0 && latestEnd[i] > time; i--) {
                    const event = events[i];
                    if (time < event.end) {
                        keys.add(event.key);
                        if (event.parentKey) keys.add(event.parentKey);
                    }
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
            function target(element: EventTarget | null): HTMLElement | null {
                return element instanceof Element ? element.closest<HTMLElement>(".transcript-event.deletion") : null;
            }
            function activate(element: HTMLElement): void {
                if (view.composing || compositionPending(view.state)) return;
                const key = element.dataset.inspection!;
                const item = informationKey.getState(view.state)?.byKey.get(key);
                if (item?.kind !== "deletion") return;
                const focused = document.activeElement === element;
                view.dispatch(view.state.tr.setMeta(informationKey, { ranges: [{ from: item.sourceFrom, to: item.sourceTo }] } satisfies InformationAction).setMeta("addToHistory", false));
                if (focused) view.dom.querySelector<HTMLElement>(`[data-inspection="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
            }
            updatePlayback();
            const geometry = inspectionGeometry(view, index, projectionOf, () => informationKey.getState(view.state)!.byKey, options.duration);
            const interaction = inspectionController(view, geometry, options);
            const observer = new ResizeObserver(interaction.refresh);
            observer.observe(view.dom);
            const listeners = new AbortController();
            const normal = { signal: listeners.signal };
            const capture = { ...normal, capture: true };
            view.dom.addEventListener("pointermove", interaction.move, normal);
            view.dom.addEventListener("pointerleave", interaction.leave, normal);
            view.dom.addEventListener("pointerdown", interaction.down, capture);
            view.dom.addEventListener("pointerdown", event => {
                release();
                const element = target(event.target);
                if (event.button !== 0 || event.ctrlKey || event.altKey || event.metaKey || !element) return;
                event.preventDefault();
                pressed = element;
                pressed.classList.add("pressed");
            }, capture);
            window.addEventListener("pointerup", interaction.up, capture);
            view.dom.addEventListener("click", interaction.click, capture);
            view.dom.addEventListener("click", event => {
                const element = target(event.target);
                if (!element || event.button !== 0 || event.ctrlKey || event.altKey || event.metaKey) return;
                event.preventDefault();
                event.stopPropagation();
                activate(element);
            }, capture);
            window.addEventListener("pointercancel", interaction.leave, normal);
            view.dom.addEventListener("focusin", interaction.focus, capture);
            view.dom.addEventListener("focusout", interaction.blur, capture);
            window.addEventListener("pointerup", release, capture);
            window.addEventListener("pointercancel", release, capture);
            window.addEventListener("keydown", interaction.modifiers, capture);
            window.addEventListener("keydown", event => {
                if (event.ctrlKey || event.altKey || event.metaKey) release();
                const element = target(event.target);
                if (!element || !view.dom.contains(element) || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
                    || event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                if (!event.repeat) activate(element);
            }, capture);
            window.addEventListener("keyup", interaction.modifiers, capture);
            window.addEventListener("blur", interaction.reset, normal);
            window.addEventListener("blur", release, normal);
            window.addEventListener("focus", interaction.refresh, normal);
            window.addEventListener("scroll", interaction.refresh, capture);
            return {
                update(_view, previous) {
                    updatePlayback();
                    interaction.update(previous);
                    if (informationKey.getState(previous)?.decorations !== informationKey.getState(view.state)?.decorations) interaction.refresh();
                },
                destroy() {
                    release();
                    listeners.abort();
                    observer.disconnect();
                    interaction.reset();
                }
            };
        }
    });
    return plugin;
}