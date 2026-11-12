import { type Editor, type EditorEvents } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { findOccurrences, preserveReplacementCase, intersectTextWindow, windowOccurrenceIndices, type FindOccurrence, type TextWindow } from "../../shared/transcript/find";
import { firstTrue } from "../../shared/util/search";
import { documentText, replaceTranscriptRanges } from "./transcript";
import { compositionPending } from "./composition";
import { subscribeTranscriptLayout } from "./layout";
import { transcriptViewport, subscribeTranscriptViewport } from "./viewport";
import { walkTranscriptDOM } from "./textDOM";
import { scrollTranscriptSelectionHead } from "./scroll";
import * as transcriptFind from "../states/transcriptFind.svelte";

type TextRun = { node: Text; from: number; to: number; group: number };
type PaintedMatch = TextWindow & { ranges: StaticRange[]; endpoints: Map<Text, string>; current: boolean };

export function attachTranscriptFind(editor: Editor): () => void {
    const view = editor.view;
    const others = new Highlight(), current = new Highlight();
    others.priority = 0;
    current.priority = 2;
    CSS.highlights.set("transcript-find", others);
    CSS.highlights.set("transcript-find-current", current);
    let occurrences: FindOccurrence[] = [];
    let document = view.state.doc;
    let selectionStart = view.state.selection.from;
    let frame = 0;
    const painted = new Map<number, PaintedMatch>();
    const viewportUse = subscribeTranscriptViewport(view, () => {
        cancelAnimationFrame(frame);
        paint();
    });

    function clear(): void {
        if (others.size) others.clear();
        if (current.size) current.clear();
        painted.clear();
    }

    function paint(): void {
        frame = 0;
        if (!transcriptFind.state.open || !transcriptFind.state.query || !occurrences.length || view.isDestroyed) return clear();
        const window = transcriptViewport(view);
        const wanted = new Map(windowOccurrenceIndices(occurrences, window, transcriptFind.state.current).map(index => [
            index, index === transcriptFind.state.current ? occurrences[index] : intersectTextWindow(occurrences[index], window)!
        ]));
        for (const [index, entry] of painted) {
            const next = wanted.get(index);
            // Check original Text nodes, not live Range endpoints that migrate to parents on removal.
            const valid = next && next.from === entry.from && next.to === entry.to
                && [...entry.endpoints].every(([node, value]) => node.isConnected && view.dom.contains(node) && node.data === value);
            if (!valid) {
                for (const range of entry.ranges) (entry.current ? current : others).delete(range);
                painted.delete(index);
            }
            else if (entry.current !== (index === transcriptFind.state.current)) {
                for (const range of entry.ranges) {
                    (entry.current ? current : others).delete(range);
                    (entry.current ? others : current).add(range);
                }
                entry.current = !entry.current;
            }
        }
        const pending = [...wanted].filter(([index]) => !painted.has(index));
        if (!pending.length) return;
        // Usually one window; a distant current match gets a separate walk without visiting the gap.
        const nearby = pending.filter(([, span]) => span.from >= window.from && span.to <= window.to);
        const coverage = nearby.length ? [{ from: nearby[0][1].from, to: nearby.at(-1)![1].to }] : [];
        for (const [, span] of pending) {
            if (span.from < window.from || span.to > window.to) coverage.push({ ...span });
        }
        coverage.sort((a, b) => a.from - b.from);
        const windows: TextWindow[] = [];
        for (const span of coverage) {
            const previous = windows.at(-1);
            if (previous && span.from <= previous.to) previous.to = Math.max(previous.to, span.to);
            else windows.push(span);
        }
        for (const coverage of windows) {
            const runs: TextRun[] = [];
            walkTranscriptDOM(view, coverage, (node, from, to, group) => {
                if (node instanceof Text) runs.push({ node, from, to, group });
            });
            for (const [index, match] of pending) {
                if (match.from < coverage.from || match.to > coverage.to) continue;
                const first = firstTrue(runs.length, i => runs[i].to > match.from);
                const fragments: { startContainer: Text; startOffset: number; endContainer: Text; endOffset: number; group: number }[] = [];
                for (let i = first; i < runs.length && runs[i].from < match.to; i++) {
                    const run = runs[i];
                    const start = Math.max(match.from, run.from) - run.from, end = Math.min(match.to, run.to) - run.from;
                    const previous = fragments.at(-1);
                    if (previous?.group === run.group) {
                        previous.endContainer = run.node;
                        previous.endOffset = end;
                    }
                    else fragments.push({ startContainer: run.node, startOffset: start, endContainer: run.node, endOffset: end, group: run.group });
                }
                const endpoints = new Map<Text, string>();
                const ranges = fragments.map(fragment => {
                    endpoints.set(fragment.startContainer, fragment.startContainer.data);
                    endpoints.set(fragment.endContainer, fragment.endContainer.data);
                    // Static ranges avoid native live-Range maintenance for thousands of DOM mutations.
                    return new StaticRange(fragment);
                });
                const entry = { ...match, ranges, endpoints, current: index === transcriptFind.state.current };
                painted.set(index, entry);
                for (const range of ranges) (entry.current ? current : others).add(range);
            }
        }
    }

    function schedule(): void {
        if (!frame) frame = requestAnimationFrame(paint);
    }

    function select(): void {
        const match = occurrences[transcriptFind.state.current];
        if (!match || view.isDestroyed) return;
        const { anchor, head } = view.state.selection;
        if (anchor !== match.from + 1 || head !== match.to + 1) {
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, match.from + 1, match.to + 1)).setMeta("addToHistory", false));
        }
        scrollTranscriptSelectionHead(view);
        schedule();
    }

    function refresh(position = view.state.selection.from - 1, jump = true): void {
        clear();
        occurrences = transcriptFind.state.open ? findOccurrences(documentText(view.state.doc), transcriptFind.state.query, transcriptFind.state) : [];
        viewportUse.setNeeded(occurrences.length > 0);
        transcriptFind.state.count = occurrences.length;
        const index = firstTrue(occurrences.length, i => occurrences[i].from >= position);
        transcriptFind.state.current = occurrences.length ? index < occurrences.length ? index : 0 : -1;
        if (jump) select();
        if (!transcriptFind.state.query || !transcriptFind.state.open) clear();
        schedule();
    }

    function update({ transaction, appendedTransactions }: EditorEvents["transaction"]): void {
        transcriptFind.state.composing = view.composing || compositionPending(view.state);
        if (document !== view.state.doc) {
            let position = (occurrences[transcriptFind.state.current]?.from ?? selectionStart - 1) + 1;
            for (const tr of [transaction, ...appendedTransactions]) position = tr.mapping.map(position, 1);
            document = view.state.doc;
            refresh(position - 1, false);
        }
        selectionStart = view.state.selection.from;
    }

    function beforeUpdate({ nextState }: EditorEvents["beforeTransaction"]): void {
        // Retire old highlights before DOM replacement and its first synchronous layout.
        if (nextState.doc !== view.state.doc) clear();
    }

    const unregister = transcriptFind.register({
        selectedText: () => view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, "\n", "\n"),
        refresh,
        clear: () => {
            viewportUse.setNeeded(false);
            clear();
        },
        canReplace: () => view.editable && !view.composing && !compositionPending(view.state),
        focusEditor: () => view.focus(),
        navigate: direction => {
            if (!transcriptFind.state.open || !occurrences.length) return;
            transcriptFind.state.current = (transcriptFind.state.current + direction + occurrences.length) % occurrences.length;
            select();
        },
        replace: all => {
            if (view.isDestroyed || !view.editable || view.composing || compositionPending(view.state)) return;
            const match = occurrences[transcriptFind.state.current];
            if (!match) return;
            if (!all && (view.state.selection.from !== match.from + 1 || view.state.selection.to !== match.to + 1)) return select();
            // Recheck the immutable displayed document, including whole-word context, before writing.
            const matches = findOccurrences(documentText(view.state.doc), transcriptFind.state.query, transcriptFind.state);
            if (!matches.some(hit => hit.from === match.from && hit.to === match.to)) return refresh();
            const text = documentText(view.state.doc);
            const edits = (all ? matches : [match]).map(hit => ({
                ...hit, text: transcriptFind.state.preserveCase ? preserveReplacementCase(text.slice(hit.from, hit.to), transcriptFind.state.replacement) : transcriptFind.state.replacement
            }));
            if (replaceTranscriptRanges(view, edits)) {
                refresh(all ? view.state.selection.from - 1 : match.from + edits[0].text.length);
            }
        }
    });
    transcriptFind.state.composing = view.composing || compositionPending(view.state);
    editor.on("beforeTransaction", beforeUpdate);
    editor.on("transaction", update);
    const unsubscribe = subscribeTranscriptLayout(view, schedule);
    return () => {
        cancelAnimationFrame(frame);
        unsubscribe();
        viewportUse.unsubscribe();
        editor.off("beforeTransaction", beforeUpdate);
        editor.off("transaction", update);
        unregister();
        if (CSS.highlights.get("transcript-find") === others) CSS.highlights.delete("transcript-find");
        if (CSS.highlights.get("transcript-find-current") === current) CSS.highlights.delete("transcript-find-current");
    };
}