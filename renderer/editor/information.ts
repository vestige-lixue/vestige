import { Fragment } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { transcriptEvents, transcriptSelectionUnits, type TranscriptInformation } from "./informationModel";
import { type TextIndex, type TextProjection } from "../../shared/transcript/text";
import { inspectionGeometry } from "./geometry";
import { inspectionController, type InspectionCallbacks } from "./interaction";
import { compositionPending } from "./composition";
import { firstTrue } from "../../shared/util/search";
import { previewUnits, renderPreview } from "./preview";

export { type InspectionInformation } from "./informationModel";
export { type TranscriptInspection } from "./interaction";
export type InspectionLabels = { restore: string; expand: string; collapse: string };
export type InspectionOptions = InspectionCallbacks & { duration: number; labels?: InspectionLabels };
type SourceRange = { from: number; to: number };
type PlaybackEvent = { start: number; end: number; key: string };
type InformationModel = { information: TranscriptInformation[]; byKey: Map<string, TranscriptInformation>; events: PlaybackEvent[]; latestEnd: number[] };
type InformationState = InformationModel & {
    decorations: DecorationSet;
    projection: TextProjection;
    expanded: SourceRange[];
    editable: boolean;
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

export function restoreTranscriptDeletion(view: EditorView, key: string): boolean {
    const information = informationKey.getState(view.state);
    const deletion = information?.byKey.get(key);
    if (!information?.editable || !view.editable || view.composing || compositionPending(view.state) || deletion?.kind !== "deletion" || !deletion.original) return false;
    const nodes = deletion.original.split("\n").flatMap((line, index) => [
        ...index ? [view.state.schema.nodes.hardBreak.create()] : [],
        ...line ? [view.state.schema.text(line)] : []
    ]);
    const position = deletion.from + 1;
    const transaction = closeHistory(view.state.tr).replaceWith(position, position, Fragment.fromArray(nodes));
    transaction.setSelection(TextSelection.create(transaction.doc, position + deletion.original.length));
    view.dispatch(transaction.scrollIntoView());
    view.focus();
    return true;
}

export function informationPlugin(index: TextIndex, projectionOf: (state: EditorState) => TextProjection, playbackOf: (state: EditorState) => number, options: InspectionOptions, canEdit: () => boolean = () => true): Plugin {
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
                if (event.range) events.push({ ...event.range, key: item.key });
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
    function marker(item: TranscriptInformation, expanded: boolean, labels: InspectionLabels): HTMLElement {
        // Native buttons inside contenteditable distort Chromium's IME text offsets.
        const marker = document.createElement("span");
        marker.tabIndex = 0;
        marker.className = `transcript-event ${item.kind} focusable${expanded ? " expanded" : ""}`;
        marker.dataset.inspection = item.key;
        if (item.kind === "deletion") {
            marker.setAttribute("role", "button");
            marker.setAttribute("aria-expanded", String(expanded));
            marker.setAttribute("aria-label", expanded ? labels.collapse : labels.expand);
        }
        const shape = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        shape.classList.add("transcript-event-shape");
        shape.setAttribute("viewBox", "0 0 10 10");
        shape.setAttribute("preserveAspectRatio", "none");
        // Cover the inner half of the stroke to preserve the triangle's filled size.
        for (const className of ["transcript-event-stroke", ""]) {
            const part = document.createElementNS("http://www.w3.org/2000/svg", "path");
            if (className) part.classList.add(className);
            part.setAttribute("d", "M0 0H10L5 10Z");
            shape.append(part);
        }
        marker.append(shape);
        return marker;
    }
    function build(state: EditorState, expanded: SourceRange[], labels: InspectionLabels): InformationState {
        const projection = projectionOf(state);
        const model = modelOf(projection);
        const editable = canEdit();
        const decorations = model.information.map(information => {
            const position = information.from;
            const open = information.kind === "deletion" && isExpanded(expanded, information);
            // Keep the default end-of-document caret inside the last text node.
            const side = position === state.doc.firstChild!.content.size ? 1 : -1;
            const key = `${side}/${information.key}/${information.sourceFrom}-${information.sourceTo}/${open}/${editable}/${JSON.stringify(labels)}/${open ? information.gaps?.map(gap => gap.key).join(",") : ""}`;
            let dom: HTMLElement | undefined;
            return Decoration.widget(position + 1, () => {
                // Mapping during composition can redraw a widget; retain its original DOM.
                if (dom) return dom;
                const anchor = document.createElement("span");
                anchor.className = "transcript-event-anchor";
                anchor.contentEditable = "false";
                const group = document.createElement("span");
                group.className = "transcript-events";
                group.append(marker(information, open, labels));
                anchor.append(group);
                if (!open) return dom = anchor;
                const expanded = document.createElement("span");
                expanded.className = "transcript-deletion-expanded";
                expanded.contentEditable = "false";
                expanded.spellcheck = false;
                expanded.append(anchor);
                const original = document.createElement("span");
                original.className = "transcript-deletion-original";
                renderPreview(original, previewUnits(information.original!, "deleted", information.gaps, information.sourceFrom), {
                    lineBreaks: true, gap: gap => marker(gap, false, labels)
                });
                expanded.append(original);
                if (editable) {
                    const restore = document.createElement("span");
                    restore.className = "transcript-restore focusable";
                    restore.tabIndex = 0;
                    restore.setAttribute("role", "button");
                    restore.dataset.restore = information.key;
                    restore.textContent = labels.restore;
                    expanded.append(restore);
                }
                return dom = expanded;
            }, { key, side, relaxedSide: true, marks: [], ignoreSelection: true, stopEvent: () => true });
        });
        return { ...model, projection, expanded, editable, labels, pending: false, decorations: DecorationSet.create(state.doc, decorations) };
    }
    const plugin = new Plugin<InformationState>({
        key: informationKey,
        state: {
            init: (_, state) => build(state, [], options.labels ?? { restore: "Restore", expand: "Expand deletion", collapse: "Collapse deletion" }),
            apply(transaction, previous, _oldState, state) {
                const action = transaction.getMeta(informationKey) as InformationAction | undefined;
                const labels = action?.labels ?? previous.labels;
                if (compositionPending(state)) return { ...previous, pending: true, labels, decorations: previous.decorations.map(transaction.mapping, transaction.doc) };
                const projection = projectionOf(state);
                if (!action && !previous.pending && previous.projection === projection && previous.editable === canEdit()) return previous;
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
            function updatePlayback(): void {
                if (compositionPending(view.state)) return;
                const time = playbackOf(view.state);
                const { events, latestEnd } = informationKey.getState(view.state)!;
                const keys = new Set<string>();
                const first = firstTrue(events.length, index => events[index].start > time);
                // Separate deletions can share token times; absorbed gaps highlight their deletion marker.
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
            function target(element: EventTarget | null): HTMLElement | null {
                return element instanceof Element ? element.closest<HTMLElement>(".transcript-event.deletion, .transcript-restore") : null;
            }
            function activate(element: HTMLElement): void {
                if (view.composing || compositionPending(view.state)) return;
                if (element.dataset.restore) {
                    restoreTranscriptDeletion(view, element.dataset.restore);
                    return;
                }
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
                if (event.button === 0 && !event.ctrlKey && !event.altKey && !event.metaKey && target(event.target)) event.preventDefault();
            }, capture);
            view.dom.addEventListener("pointerup", interaction.move, capture);
            view.dom.addEventListener("click", interaction.click, capture);
            view.dom.addEventListener("click", event => {
                const element = target(event.target);
                if (!element || event.button !== 0 || event.ctrlKey || event.altKey || event.metaKey) return;
                event.preventDefault();
                event.stopPropagation();
                activate(element);
            }, capture);
            view.dom.addEventListener("pointercancel", interaction.leave, normal);
            view.dom.addEventListener("focusin", interaction.focus, capture);
            view.dom.addEventListener("focusout", interaction.blur, capture);
            window.addEventListener("keydown", interaction.modifiers, capture);
            window.addEventListener("keydown", event => {
                const element = target(event.target);
                if (!element || !view.dom.contains(element) || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
                    || event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                if (!event.repeat) activate(element);
            }, capture);
            window.addEventListener("keyup", interaction.modifiers, capture);
            window.addEventListener("blur", interaction.reset, normal);
            window.addEventListener("focus", interaction.refresh, normal);
            window.addEventListener("scroll", interaction.refresh, capture);
            return {
                update(_view, previous) {
                    updatePlayback();
                    interaction.update(previous);
                    if (informationKey.getState(previous)?.decorations !== informationKey.getState(view.state)?.decorations) interaction.refresh();
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