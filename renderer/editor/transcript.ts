import { Editor, Extension, Mark, Node, type Extensions, type JSONContent } from "@tiptap/core";
import { Fragment, Slice, type Node as PMNode, type Mark as PMMark, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction, type EditorState, type Selection } from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";
import { dropCursorPlugin } from "./dropCursor";
import { compositionPlugin, compositionActive, compositionCommit, compositionPending } from "./composition";
import { caretPlugin } from "./caret";
import { transcriptLayoutPlugin } from "./layout";
import { type VocabularyGroup } from "../../shared/vocabulary/match";
import { transcriptScrollPlugin, scrollTranscriptPlayback, scrollTranscriptSelectionHead, dispatchPreservingScroll } from "./scroll";
import { firstTrue } from "../../shared/util/search";
import { ProjectionStep, projectionTransaction } from "./projectionStep";
import { history, undo, redo, closeHistory } from "@tiptap/pm/history";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { type Modification } from "../../shared/Vestige";
import { type Run } from "../../shared/transcription/Run";
import { type EditAction } from "../../shared/app";
import { closeTranscriptMenu, editTranscriptMenu, canRestoreDeletion, restoreDeletion, type TranscriptMenuRequest } from "./menuTarget";
import { type Range } from "../../shared/util/range";
import { informationPlugin, toggleSelectionDeletions, toggleDeletion, transcriptDeletion, transcriptPlaybackMarkers, type InspectionOptions } from "./information";
import {
    createTextIndex, projectText, editText, commitText, textPieces, sourceTextPieces, projectionOffset, provenanceChange,
    alignText, canAlignText, textReplacement, replaceText, type TextReplacement, type TextIndex, type TextProjection
} from "../../shared/transcript/text";

type DirtyRange = { from: number; to: number };
type PendingEdit = { from: number; to: number; end: number };
type BridgeState = { index: TextIndex; projection: TextProjection; saved: TextProjection; dirty: DirtyRange[]; pendingEdit: PendingEdit | null };
const bridgeKey = new PluginKey<BridgeState>("vestigeTranscript");
type PlaybackState = { time: number; follow: boolean; projection: TextProjection; ranges: number[]; decorations: DecorationSet };
const playbackKey = new PluginKey<PlaybackState>("vestigePlayback");
const probabilityThresholds = [0.2, 0.4, 0.6, 0.8, Infinity];
const editors = new Map<HTMLElement, Editor>();
const texts = new WeakMap<PMNode, string>();
const sourceDOM = new WeakMap<HTMLElement, { kind: string; index: number }>();

const Document = Node.create({ name: "doc", topNode: true, content: "paragraph" });

const Paragraph = Node.create({
    // ProseMirror's modifier-click node selection would select the entire single-paragraph transcript.
    name: "paragraph", group: "block", content: "(text | hardBreak)*", whitespace: "pre", selectable: false,
    parseHTML() {
        return [{ tag: "div" }, { tag: "p" }];
    },
    renderHTML() {
        return ["div", 0];
    }
});

const Text = Node.create({ name: "text", group: "inline" });
const HardBreak = Node.create({
    name: "hardBreak", inline: true, group: "inline", selectable: false,
    parseHTML() {
        return [{ tag: "br" }];
    },
    renderHTML() {
        return ["br"];
    },
    renderText() {
        return "\n";
    }
});

const Source = Mark.create({
    name: "source",
    addAttributes() {
        return { kind: { default: "segment", rendered: false }, index: { default: 0, rendered: false } };
    },
    // Composition can detach ProseMirror's mark descriptions. Preserve locally rendered identities;
    // pasted HTML has new DOM nodes and must never supply source identities.
    parseHTML() {
        return [{ tag: "span", getAttrs: element => sourceDOM.get(element) ?? false }];
    },
    renderHTML() {
        return ["span", 0];
    }
});

export function documentText(doc: PMNode): string {
    let text = texts.get(doc);
    if (text === undefined) {
        text = doc.firstChild!.textBetween(0, doc.firstChild!.content.size, "", "\n");
        texts.set(doc, text);
    }
    return text;
}

function inlineContent(text: string, marks?: JSONContent["marks"]): JSONContent[] {
    const content: JSONContent[] = [];
    const lines = text.split("\n");
    lines.forEach((line, index) => {
        if (index) content.push({ type: "hardBreak", marks });
        if (line) content.push({ type: "text", text: line, marks });
    });
    return content;
}

function projectedContent(index: TextIndex, projection: TextProjection, from = 0, to = projection.text.length): JSONContent[] {
    return textPieces(index, projection, from, to, true).flatMap(piece => {
        const text = projection.text.slice(Math.max(from, piece.utf16From), Math.min(to, piece.utf16To));
        return inlineContent(text, [{ type: "source", attrs: markSource(piece.source) }]);
    });
}

function contentOf(index: TextIndex, projection: TextProjection): JSONContent {
    return { type: "doc", content: [{ type: "paragraph", content: projectedContent(index, projection) }] };
}

export function transcriptContent(index: TextIndex, modifications: readonly Modification[]): JSONContent {
    return contentOf(index, projectText(index, modifications));
}

function markSource(source: { kind: string; index: number }): { kind: string; index: number } {
    // Added text shares one visual style; its exact provenance belongs to the projection, not a DOM mark.
    return source.kind === "segment" ? source : { kind: "modification", index: 0 };
}

function plainSlice(schema: Schema, text: string): Slice {
    const nodes = inlineContent(text.replace(/\r\n?/g, "\n")).map(node => schema.nodeFromJSON(node));
    return new Slice(Fragment.fromArray(nodes), 0, 0);
}

function splitsCodepoint(text: string, offset: number): boolean {
    return offset > 0 && offset < text.length && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset]);
}

function applyTextSteps(index: TextIndex, projection: TextProjection, transaction: Transaction, restore: boolean, edited: (from: number, to: number, length: number) => void): TextProjection {
    for (let i = 0; i < transaction.steps.length; i++) {
        const before = projection.text;
        const after = documentText(transaction.docs[i + 1] ?? transaction.doc);
        const changes: { from: number; to: number; start: number; end: number }[] = [];
        transaction.steps[i].getMap().forEach((from, to, start, end) => {
            changes.push({
                from: Math.max(0, Math.min(before.length, from - 1)),
                to: Math.max(0, Math.min(before.length, to - 1)),
                start: Math.max(0, Math.min(after.length, start - 1)),
                end: Math.max(0, Math.min(after.length, end - 1))
            });
        });
        // Only expand split codepoints. Native input ranges identify unchanged DOM neighbors;
        // equal text or token marks alone cannot prove that a replaced character kept its source.
        for (const change of changes) {
            while (splitsCodepoint(before, change.from) || splitsCodepoint(after, change.start)) {
                change.from--;
                change.start--;
            }
            while (splitsCodepoint(before, change.to) || splitsCodepoint(after, change.end)) {
                change.to++;
                change.end++;
            }
        }
        // Expanded ranges may meet. Compose them before changing the working projection.
        const merged: typeof changes = [];
        for (const change of changes) {
            const previous = merged.at(-1);
            if (previous && (change.from <= previous.to || change.start <= previous.end)) {
                previous.to = Math.max(previous.to, change.to);
                previous.end = Math.max(previous.end, change.end);
            }
            else merged.push(change);
        }
        for (const change of merged.reverse()) {
            const from = projectionOffset(projection, change.from, false), to = projectionOffset(projection, change.to, false);
            const text = after.slice(change.start, change.end);
            projection = editText(index, projection, from, to, text, restore);
            edited(from, to, Array.from(text).length);
        }
        if (projection.text !== after) throw new Error("Transcript transaction did not preserve rendered text.");
    }
    return projection;
}

function synchronizeMarks(index: TextIndex, transaction: Transaction, projection: TextProjection, ranges: DirtyRange[]): void {
    const changes: { from: number; to: number; mark: PMMark }[] = [];
    for (const dirty of ranges) {
        // DOM diffs may replace one UTF-16 half of a character; provenance marks follow whole codepoints.
        const range = { ...dirty };
        if (splitsCodepoint(projection.text, range.from - 1)) range.from--;
        if (splitsCodepoint(projection.text, range.to - 1)) range.to++;
        const spans = textPieces(index, projection, range.from - 1, range.to - 1, true)
            .filter(piece => piece.utf16From < piece.utf16To && piece.utf16From < range.to - 1 && piece.utf16To > range.from - 1)
            .map(piece => ({ from: piece.utf16From + 1, to: piece.utf16To + 1, mark: transaction.doc.type.schema.marks.source.create(markSource(piece.source)) }));
        let first = 0;
        transaction.doc.nodesBetween(range.from, range.to, (node, from) => {
            if (!node.isInline) return;
            const to = from + node.nodeSize;
            while (first < spans.length && spans[first].to <= from) first++;
            for (let i = first; i < spans.length && spans[i].from < to; i++) {
                const span = spans[i];
                if (span.mark.isInSet(node.marks)) continue;
                const start = Math.max(from, span.from, range.from);
                const end = Math.min(to, span.to, range.to);
                if (start >= end) continue;
                const previous = changes.at(-1);
                if (previous && previous.to === start && previous.mark.eq(span.mark)) previous.to = end;
                else changes.push({ from: start, to: end, mark: span.mark });
            }
        });
    }
    for (const change of changes) {
        transaction.removeMark(change.from, change.to, change.mark.type);
        transaction.addMark(change.from, change.to, change.mark);
    }
}

function dirtyRanges(index: TextIndex, previous: BridgeState, projection: TextProjection, transaction: Transaction): DirtyRange[] {
    const ranges = previous.dirty.map(range => ({ from: transaction.mapping.map(range.from, -1), to: transaction.mapping.map(range.to, 1) }));
    transaction.mapping.maps.forEach((map, step) => {
        const after = transaction.mapping.slice(step + 1);
        map.forEach((_from, _to, from, to) => ranges.push({ from: after.map(from, -1), to: after.map(to, 1) }));
    });
    // Explicit alignment changes provenance without changing text or contributing a document map.
    const change = projection === previous.projection ? null : provenanceChange(index, previous.projection, projection);
    if (change) ranges.push({ from: projectionOffset(projection, change.from, true) + 1, to: projectionOffset(projection, change.to, true) + 1 });
    const merged: DirtyRange[] = [];
    const end = transaction.doc.content.size - 1;
    for (const range of ranges.sort((left, right) => left.from - right.from)) {
        range.from = Math.max(1, Math.min(end, range.from));
        range.to = Math.max(range.from, Math.min(end, range.to));
        const previous = merged.at(-1);
        if (previous && previous.to >= range.from) previous.to = Math.max(previous.to, range.to);
        else merged.push(range);
    }
    return merged;
}

export function transcriptProjection(state: EditorState): TextProjection {
    return bridgeKey.getState(state)!.projection;
}

export function transcriptModifications(state: EditorState): Modification[] {
    return bridgeKey.getState(state)!.saved.modifications;
}

export function transcriptPlugins(index: TextIndex, canEdit: () => boolean = () => true, initial = projectText(index, [])): Plugin[] {
    let nativeInput: { doc: PMNode; from: number; to: number; text: string } | null = null;
    const bridge = new Plugin<BridgeState>({
        key: bridgeKey,
        state: {
            init: () => ({ index, projection: initial, saved: initial, dirty: [], pendingEdit: null }),
            apply(transaction, previous, _oldState, newState) {
                const snapshot = transaction.steps.findLast(step => step instanceof ProjectionStep);
                const restore = !compositionActive(newState) && !compositionCommit(transaction);
                let pendingEdit = previous.pendingEdit;
                const edited = (from: number, to: number, length: number): void => {
                    if (!compositionActive(newState) && !compositionCommit(transaction)) return;
                    pendingEdit = pendingEdit ? {
                        from: Math.min(pendingEdit.from, from),
                        to: pendingEdit.to + Math.max(0, to - pendingEdit.end),
                        end: Math.max(pendingEdit.end, to) + length - (to - from)
                    } : { from, to, end: from + length };
                };
                let projection = previous.projection;
                if (snapshot instanceof ProjectionStep) projection = snapshot.afterProjection ?? projectText(index, snapshot.after);
                else if (!transaction.getMeta(bridgeKey)) {
                    const input = nativeInput;
                    if (input && input.doc === transaction.before
                        && documentText(transaction.doc) === projection.text.slice(0, input.from) + input.text + projection.text.slice(input.to)) {
                        nativeInput = null;
                        const from = projectionOffset(projection, input.from, false), to = projectionOffset(projection, input.to, false);
                        projection = editText(index, projection, from, to, input.text, restore);
                        edited(from, to, Array.from(input.text).length);
                    }
                    else projection = applyTextSteps(index, projection, transaction, restore, edited);
                }
                if (compositionCommit(transaction)) {
                    projection = commitText(index, previous.saved, projection, pendingEdit ?? undefined);
                    pendingEdit = null;
                    nativeInput = null;
                }
                if (snapshot) pendingEdit = null;
                return {
                    index, projection, pendingEdit,
                    saved: snapshot ? projection : previous.saved,
                    dirty: transaction.getMeta(bridgeKey) === true ? [] : dirtyRanges(index, previous, projection, transaction)
                };
            }
        },
        filterTransaction(transaction) {
            return (!transaction.docChanged || canEdit()) && transaction.doc.childCount === 1 && transaction.doc.firstChild?.type.name === "paragraph";
        },
        appendTransaction(transactions, _oldState, newState) {
            if (!transactions.some(transaction => compositionCommit(transaction)
                || transaction.docChanged && !transaction.getMeta(bridgeKey))) return null;
            const { projection, saved, dirty } = bridgeKey.getState(newState)!;
            if (projection.text !== documentText(newState.doc)) throw new Error("Transcript and modifications diverged.");
            // ProseMirror owns the composition DOM until the final input has been consumed.
            if (compositionActive(newState)) return null;
            const transaction = newState.tr.setMeta(bridgeKey, true);
            if (projection !== saved) transaction.step(new ProjectionStep(saved.modifications, projection.modifications, saved, projection));
            synchronizeMarks(index, transaction, projection, dirty);
            return transaction.steps.length || dirty.length ? transaction : null;
        },
        props: {
            clipboardTextParser(text, $context) {
                return plainSlice($context.doc.type.schema, text);
            },
            transformPasted(slice, view) {
                return plainSlice(view.state.schema, slice.content.textBetween(0, slice.content.size, "\n", "\n"));
            },
            clipboardTextSerializer(slice) {
                return slice.content.textBetween(0, slice.content.size, "\n", "\n");
            },
            handleDrop(view, event, slice, moved) {
                if (!moved) return false;
                const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (!position) return false;
                const target = dropPoint(view.state.doc, position.pos, slice) ?? position.pos;
                const { from, to } = view.state.selection;
                // Moving onto the selection, including its edges, must not delete and reinsert its source history.
                return target >= from && target <= to;
            },
            handleDOMEvents: {
                beforeinput(view, event) {
                    if (view.editable && ["insertText", "insertCompositionText", "insertReplacementText"].includes(event.inputType) && event.data !== null) {
                        const range = event.getTargetRanges()[0];
                        if (range && view.dom.contains(range.startContainer) && view.dom.contains(range.endContainer)) {
                            const from = view.posAtDOM(range.startContainer, range.startOffset) - 1, to = view.posAtDOM(range.endContainer, range.endOffset) - 1;
                            const text = documentText(view.state.doc);
                            if (from >= 0 && from <= to && to <= text.length && !splitsCodepoint(text, from) && !splitsCodepoint(text, to)) {
                                nativeInput = { doc: view.state.doc, from, to, text: event.data };
                            }
                        }
                    }
                    if (!view.editable || event.defaultPrevented || event.isComposing || view.composing) return false;
                    if (event.cancelable && event.inputType === "insertText" && event.data !== null) {
                        event.preventDefault();
                        view.dispatch(view.state.tr.replaceSelection(plainSlice(view.state.schema, event.data)).scrollIntoView());
                        return true;
                    }
                    if (event.cancelable && /^delete(?:Content|Word|SoftLine|HardLine)(?:Backward|Forward)$/.test(event.inputType)) {
                        const ranges = event.getTargetRanges();
                        if (ranges.length !== 1) return false;
                        const range = ranges[0];
                        if (!view.dom.contains(range.startContainer) || !view.dom.contains(range.endContainer)) return false;
                        const from = view.posAtDOM(range.startContainer, range.startOffset);
                        const to = view.posAtDOM(range.endContainer, range.endOffset);
                        if (from < 1 || to > view.state.doc.content.size - 1 || from >= to) return false;
                        // Native deletion across token spans/widgets repeatedly lays out the paragraph.
                        // Keep the browser's grapheme/word boundaries, but apply the edit through a transaction.
                        event.preventDefault();
                        view.dispatch(view.state.tr.delete(from, to).scrollIntoView());
                        return true;
                    }
                    if (!["insertParagraph", "insertLineBreak"].includes(event.inputType)) return false;
                    event.preventDefault();
                    view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.hardBreak.create()).scrollIntoView());
                    return true;
                }
            }
        }
    });
    const intervals = index.transcript.map((segment, segmentIdx) => ({ ...segment.range, segmentIdx }))
        .sort((left, right) => left.start - right.start);
    const latestEnd: number[] = [];
    for (const interval of intervals) latestEnd.push(Math.max(latestEnd.at(-1) ?? -Infinity, interval.end));
    function playbackRanges(projection: TextProjection, time: number): number[] {
        const ranges: number[] = [];
        const first = firstTrue(intervals.length, index => intervals[index].start > time);
        for (let i = first - 1; i >= 0 && latestEnd[i] > time; i--) {
            const { segmentIdx, end } = intervals[i];
            if (end <= time) continue;
            for (const piece of sourceTextPieces(index, projection, index.starts[segmentIdx], index.starts[segmentIdx + 1])) {
                if (piece.source.kind === "segment" && piece.source.index === segmentIdx) ranges.push(piece.utf16From + 1, piece.utf16To + 1);
            }
        }
        return ranges;
    }
    function sameRanges(left: number[], right: number[]): boolean {
        return left === right || left.length === right.length && left.every((position, i) => position === right[i]);
    }
    const playback = new Plugin<PlaybackState>({
        key: playbackKey,
        state: {
            init: () => ({ time: -1, follow: false, projection: initial, ranges: [], decorations: DecorationSet.empty }),
            apply(transaction, previous, oldState, state) {
                const { time, follow } = (transaction.getMeta(playbackKey) as Pick<PlaybackState, "time" | "follow"> | undefined) ?? previous;
                // Changing token spans during composition corrupts Chromium's IME offsets beside inline markers.
                // Keep their identities, but map positions so text inserted before a highlight does not shift it.
                if (compositionActive(state)) {
                    return { ...previous, time, follow, decorations: previous.decorations.map(transaction.mapping, transaction.doc) };
                }
                const projection = transcriptProjection(state);
                // Even a cancelled composition must resume at the latest playback time.
                const unchanged = !compositionActive(oldState) && projection === previous.projection;
                if (unchanged && time === previous.time) return follow === previous.follow ? previous : { ...previous, follow };
                const ranges = playbackRanges(projection, time);
                if (unchanged && sameRanges(ranges, previous.ranges)) return { ...previous, time, follow };
                const decorations: Decoration[] = [];
                for (let i = 0; i < ranges.length; i += 2) decorations.push(Decoration.inline(ranges[i], ranges[i + 1], { class: "current" }));
                return { time, follow, projection, ranges, decorations: DecorationSet.create(state.doc, decorations) };
            }
        },
        props: {
            decorations: state => playbackKey.getState(state)?.decorations ?? DecorationSet.empty
        },
        view(view) {
            let rendered = playbackKey.getState(view.state)!;
            return {
                update(view) {
                    if (compositionPending(view.state)) return;
                    const previous = rendered;
                    rendered = playbackKey.getState(view.state)!;
                    if (!rendered.follow || previous.time === rendered.time) return;
                    // Compare both times in the current transcript, including its currently visible markers.
                    const before = previous.projection === rendered.projection ? previous.ranges : playbackRanges(rendered.projection, previous.time);
                    const markers = transcriptPlaybackMarkers(view, rendered.time);
                    if (sameRanges(before, rendered.ranges)) {
                        const previousMarkers = new Set(transcriptPlaybackMarkers(view, previous.time));
                        if (markers.length === previousMarkers.size && markers.every(marker => previousMarkers.has(marker))) return;
                    }
                    scrollTranscriptPlayback(view, rendered.ranges, markers);
                }
            };
        }
    });
    // Layout must update before the information plugin registered later reads viewport geometry.
    return [compositionPlugin(), bridge, caretPlugin(), transcriptLayoutPlugin(), transcriptScrollPlugin(), dropCursorPlugin(), playback, history()];
}

export function transcriptExtensions(index: TextIndex, canEdit: () => boolean = () => true, initial = projectText(index, [])): Extensions {
    const source = Source.extend({
        renderHTML({ mark }) {
            const dom = document.createElement("span");
            sourceDOM.set(dom, { kind: mark.attrs.kind, index: mark.attrs.index });
            if (mark.attrs.kind !== "segment") dom.className = "transcript-text transcript-added";
            else {
                const probability = index.transcript[mark.attrs.index].token.prob;
                const level = probabilityThresholds.findIndex(threshold => probability < threshold);
                dom.className = `transcript-text token-prob-${level}`;
            }
            return { dom, contentDOM: dom };
        }
    });
    const bridge = Extension.create({
        name: "vestigeTranscript", priority: 1000,
        addProseMirrorPlugins() {
            return transcriptPlugins(index, canEdit, initial);
        },
        addKeyboardShortcuts() {
            const lineBreak = (): boolean => this.editor.commands.command(({ tr, dispatch }) => {
                if (dispatch) tr.replaceSelectionWith(this.editor.schema.nodes.hardBreak.create()).scrollIntoView();
                return true;
            });
            return {
                Enter: lineBreak, "Shift-Enter": lineBreak, "Mod-Enter": lineBreak
            };
        }
    });
    return [Document, Paragraph, Text, HardBreak, source, bridge];
}

export function createTranscriptEditor(element: HTMLElement, run: Run, modifications: readonly Modification[], onChange: (modifications: Modification[]) => void, canEdit: () => boolean = () => true, inspection?: InspectionOptions): Editor {
    const index = createTextIndex(run.transcript);
    const initial = projectText(index, modifications);
    let previous = initial.modifications;
    const editor = new Editor({
        element, extensions: transcriptExtensions(index, canEdit, initial), content: contentOf(index, initial),
        injectCSS: false, enableInputRules: false, enablePasteRules: false,
        editorProps: { attributes: { autocapitalize: "off", writingsuggestions: "false", autocorrect: "off" } },
        onTransaction({ editor }) {
            const next = transcriptModifications(editor.state);
            if (next === previous) return;
            previous = next;
            onChange(next);
        }
    });
    if (inspection) editor.registerPlugin(informationPlugin(index, transcriptProjection, state => playbackKey.getState(state)?.time ?? -1, inspection));
    const target = editor.view.dom;
    editors.set(target, editor);
    editor.on("destroy", () => {
        editors.delete(target);
    });
    return editor;
}

export function transcriptEditorTarget(): HTMLElement | null {
    for (const [element, editor] of editors) {
        if (element.isConnected && !editor.isDestroyed) return element;
    }
    return null;
}

function transcriptEditorAt(element: HTMLElement | null): Editor | null {
    for (let current = element; current; current = current.parentElement) {
        const editor = editors.get(current);
        if (editor && !editor.isDestroyed) return editor;
    }
    return null;
}

export function isTranscriptEditorTarget(element: HTMLElement | null): boolean {
    return transcriptEditorAt(element) !== null;
}

export function toggleTranscriptDeletions(element: HTMLElement | null): boolean {
    const editor = transcriptEditorAt(element);
    return editor ? toggleSelectionDeletions(editor.view) : false;
}

export function toggleTranscriptDeletion(element: HTMLElement | null, key: string): boolean {
    const editor = transcriptEditorAt(element);
    return editor ? toggleDeletion(editor.view, key) : false;
}

export function transcriptDeletionRestorable(element: HTMLElement | null, key: string): boolean {
    const editor = transcriptEditorAt(element);
    return editor ? canRestoreDeletion(editor.view, transcriptDeletion(editor.view, key)) : false;
}

export function restoreTranscriptDeletion(element: HTMLElement | null, key: string): boolean {
    const editor = transcriptEditorAt(element);
    if (!editor) return false;
    const { index, projection } = bridgeKey.getState(editor.state)!;
    return restoreDeletion(editor.view, transcriptDeletion(editor.view, key), index, projection);
}

export function canAlignTranscriptSelection(view: EditorView, selection: Selection = view.state.selection): boolean {
    if (view.isDestroyed || view.composing || compositionPending(view.state) || selection.empty) return false;
    const { index, projection } = bridgeKey.getState(view.state)!;
    return canAlignText(index, projection, projectionOffset(projection, selection.from - 1, false), projectionOffset(projection, selection.to - 1, false));
}

function transcriptAlignment(view: EditorView, selection: Selection = view.state.selection): TextProjection | null {
    if (view.isDestroyed || view.composing || compositionPending(view.state) || selection.empty) return null;
    const { index, projection } = bridgeKey.getState(view.state)!;
    const aligned = alignText(index, projection, projectionOffset(projection, selection.from - 1, false), projectionOffset(projection, selection.to - 1, false));
    return aligned === projection ? null : aligned;
}

export function alignTranscriptSelection(view: EditorView): boolean {
    if (!view.editable) return false;
    const aligned = transcriptAlignment(view);
    if (!aligned) return false;
    dispatchPreservingScroll(view, closeHistory(projectionTransaction(view.state, transcriptProjection(view.state), aligned)));
    view.focus();
    return true;
}

export function transcriptReferenceTarget(request: TranscriptMenuRequest): { range: Range; position: number; replacement: TextReplacement | null } | null {
    const { view, target, selection } = request;
    if (view.isDestroyed || view.state.doc !== request.doc || view.composing || compositionPending(view.state)) return null;
    const { index, projection } = bridgeKey.getState(view.state)!;
    const information = target.information;
    if (!information?.range) return null;
    const position = projectionOffset(projection, target.position - 1, false);
    if (target.kind === "gap") return { range: information.range, position, replacement: null };
    if (target.kind !== "selection" || selection.empty || target.selectionKind === "added" || information.kind !== "selection") return null;
    const tokens = information.tokens;
    if (!tokens.length) return null;
    const from = projectionOffset(projection, selection.from - 1, false);
    const to = projectionOffset(projection, selection.to - 1, false);
    const replacement = textReplacement(index, projection, tokens, from, to, position);
    if (!replacement) return null;
    const range = target.selectionKind === "mixed" ? {
        start: tokens.reduce((start, token) => Math.min(start, index.transcript[token].range.start), Infinity),
        end: tokens.reduce((end, token) => Math.max(end, index.transcript[token].range.end), -Infinity)
    } : information.range;
    return { range, position, replacement };
}

export function applyTranscriptReference(request: TranscriptMenuRequest, text: string): boolean {
    if (!request.view.editable) return false;
    const target = transcriptReferenceTarget(request);
    if (!target) return false;
    const { view } = request;
    const { index, projection } = bridgeKey.getState(view.state)!;
    const next = target.replacement ? replaceText(index, projection, target.replacement, text)
        : editText(index, projection, target.position, target.position, text, false);
    if (next === projection) return false;
    dispatchPreservingScroll(view, closeHistory(projectionTransaction(view.state, projection, next)));
    view.focus();
    return true;
}

export function applyTranscriptVocabulary(request: TranscriptMenuRequest, { rule, ranges }: VocabularyGroup): boolean {
    const { view } = request;
    if (view.isDestroyed || !view.editable || view.state.doc !== request.doc || view.composing || compositionPending(view.state)) return false;
    const { index, projection } = bridgeKey.getState(view.state)!;
    if (!rule.enabled || !ranges.length || !rule.source || rule.source === rule.replacement) return false;
    // Validate against the same immutable document used for matching, then work backwards so offsets stay valid.
    const { empty, from: start, to: end } = request.selection;
    if (empty && (ranges.length !== 1 || ranges[0].from > start - 1 || ranges[0].to < start - 1)) return false;
    const lower = empty ? 0 : Math.max(0, start - 1);
    let next = projection, right = empty ? projection.text.length : Math.min(end - 1, projection.text.length);
    for (let i = ranges.length - 1; i >= 0; i--) {
        const { from, to } = ranges[i];
        if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < lower || to > right || from >= to
            || projection.text.slice(from, to) !== rule.source || splitsCodepoint(projection.text, from) || splitsCodepoint(projection.text, to)) return false;
        next = editText(index, next, projectionOffset(projection, from, false), projectionOffset(projection, to, false), rule.replacement, false);
        right = from;
    }
    // Supply the final marks in the same replace step. Re-marking every intervening token individually
    // creates thousands of steps and mappings for one selection-wide replacement.
    let replacement;
    if (ranges.length > 1) {
        const from = ranges[0].from, to = ranges[ranges.length - 1].to;
        const end = to + next.text.length - projection.text.length;
        const nodes = projectedContent(index, next, from, end).map(node => view.state.schema.nodeFromJSON(node));
        replacement = { from, to, content: Fragment.fromArray(nodes) };
    }
    dispatchPreservingScroll(view, closeHistory(projectionTransaction(view.state, projection, next, replacement)));
    // Keep the following keystroke out of this explicit replacement's undo entry too.
    view.dispatch(closeHistory(view.state.tr).setMeta("addToHistory", false));
    return true;
}

export function dismissTranscriptMenu(element: HTMLElement | null): void {
    const editor = transcriptEditorAt(element);
    if (editor) closeTranscriptMenu(editor.view);
}

export function handleTranscriptMenuEdit(element: HTMLElement | null, action: EditAction): boolean {
    const editor = transcriptEditorAt(element);
    return editor ? editTranscriptMenu(editor.view, action) : false;
}

export function transcriptEditAvailable(element: HTMLElement | null, action: EditAction): boolean | null {
    const editor = transcriptEditorAt(element);
    if (!editor) return null;
    if (action === "selectAll") return true;
    if (action === "paste") return editor.isEditable;
    if (action === "cut" || action === "copy") {
        const { from, to } = editor.state.selection;
        return (action === "copy" || editor.isEditable) && !!editor.state.doc.textBetween(from, to, "\n", "\n");
    }
    return editor.isEditable && (action === "undo" ? undo : redo)(editor.state);
}

export function handleTranscriptEdit(element: HTMLElement | null, action: EditAction): boolean {
    const editor = transcriptEditorAt(element);
    if (!editor) return false;
    if (!transcriptEditAvailable(element, action)) return true;
    if (action === "undo" || action === "redo") {
        (action === "undo" ? undo : redo)(editor.state, transaction => {
            // Undo can remove a focused event marker. Keep the next edit command inside this editor.
            if (document.activeElement !== editor.view.dom && editor.view.dom.contains(document.activeElement)) editor.view.focus();
            editor.view.dispatch(transaction);
            scrollTranscriptSelectionHead(editor.view);
        });
    }
    else {
        // Restore the editor's stored selection before selecting or using the native clipboard.
        editor.view.focus();
        if (action === "selectAll") editor.commands.selectAll();
        else window.api.edit(action);
    }
    return true;
}

export function setTranscriptPlayback(editor: Editor, time: number, follow = false): void {
    if (editor.isDestroyed) return;
    const previous = playbackKey.getState(editor.state);
    if (previous?.time !== time || previous.follow !== follow) {
        editor.view.dispatch(editor.state.tr.setMeta(playbackKey, { time, follow }).setMeta("addToHistory", false));
    }
}