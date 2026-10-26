import { Editor, Extension, Mark, Node, type Extensions, type JSONContent } from "@tiptap/core";
import { Fragment, Slice, type Node as PMNode, type Mark as PMMark, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction, type EditorState } from "@tiptap/pm/state";
import { compositionPlugin, compositionActive, compositionCommit } from "./composition";
import { caretPlugin } from "./caret";
import { firstTrue } from "../../shared/util/search";
import { ProjectionStep } from "./projectionStep";
import { history, undo, redo } from "@tiptap/pm/history";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { type Modification } from "../../shared/Vestige";
import { type Run } from "../../shared/transcription/Run";
import { type EditAction } from "../../shared/app";
import { informationPlugin, type InspectionOptions } from "./information";
import {
    createTextIndex, projectText, editText, textPieces, sourceTextPieces, projectionOffset, provenanceChange,
    type TextIndex, type TextProjection
} from "../../shared/transcript/text";

type DirtyRange = { from: number; to: number };
type BridgeState = { projection: TextProjection; saved: TextProjection; dirty: DirtyRange[] };
const bridgeKey = new PluginKey<BridgeState>("vestigeTranscript");
const playbackKey = new PluginKey<number>("vestigePlayback");
const probabilityThresholds = [0.2, 0.4, 0.6, 0.8, Infinity];
const editors = new WeakMap<HTMLElement, Editor>();
const texts = new WeakMap<PMNode, string>();

const Document = Node.create({ name: "doc", topNode: true, content: "paragraph" });

const Paragraph = Node.create({
    name: "paragraph", group: "block", content: "(text | hardBreak)*", whitespace: "pre",
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
    // Source identities are generated locally, including when pasting our own HTML.
    parseHTML() {
        return [];
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

function contentOf(index: TextIndex, projection: TextProjection): JSONContent {
    return {
        type: "doc",
        content: [{ type: "paragraph", content: textPieces(index, projection).flatMap(piece => inlineContent(piece.text, [{ type: "source", attrs: markSource(piece.source) }])) }]
    };
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

function applyTextSteps(index: TextIndex, projection: TextProjection, transaction: Transaction): TextProjection {
    for (let i = 0; i < transaction.steps.length; i++) {
        const before = projection.text;
        const after = documentText(transaction.docs[i + 1] ?? transaction.doc);
        if (before === after) continue;
        const changes: { from: number; to: number; start: number; end: number }[] = [];
        transaction.steps[i].getMap().forEach((from, to, start, end) => {
            changes.push({
                from: Math.max(0, Math.min(before.length, from - 1)),
                to: Math.max(0, Math.min(before.length, to - 1)),
                start: Math.max(0, Math.min(after.length, start - 1)),
                end: Math.max(0, Math.min(after.length, end - 1))
            });
        });
        // DOM reparsing can include unchanged neighbors when their source marks change.
        for (const change of changes) {
            while (change.from < change.to && change.start < change.end && before[change.from] === after[change.start]) {
                change.from++;
                change.start++;
            }
            while (change.from < change.to && change.start < change.end && before[change.to - 1] === after[change.end - 1]) {
                change.to--;
                change.end--;
            }
            // Keep codepoints intact after trimming the unchanged prefix and suffix.
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
            projection = editText(index, projection, projectionOffset(projection, change.from, false), projectionOffset(projection, change.to, false), after.slice(change.start, change.end));
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
    // Normalization can change the provenance of untouched neighbors, e.g. D18 restoring earlier typed text.
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
    const bridge = new Plugin<BridgeState>({
        key: bridgeKey,
        state: {
            init: () => ({ projection: initial, saved: initial, dirty: [] }),
            apply(transaction, previous) {
                const snapshot = transaction.steps.findLast(step => step instanceof ProjectionStep);
                const projection = snapshot instanceof ProjectionStep ? snapshot.afterProjection ?? projectText(index, snapshot.after)
                    : transaction.getMeta(bridgeKey) ? previous.projection : applyTextSteps(index, previous.projection, transaction);
                return {
                    projection,
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
            handleDOMEvents: {
                beforeinput(view, event) {
                    if (!view.editable || event.defaultPrevented || event.isComposing || view.composing) return false;
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
    let previousProjection: TextProjection | undefined;
    let previousTime = NaN;
    let previousRanges: number[] = [];
    let previousDecorations = DecorationSet.empty;
    const playback = new Plugin<number>({
        key: playbackKey,
        state: { init: () => -1, apply: (transaction, time) => transaction.getMeta(playbackKey) ?? time },
        props: {
            decorations(state) {
                const time = playbackKey.getState(state) ?? -1;
                const projection = transcriptProjection(state);
                if (projection === previousProjection && time === previousTime) return previousDecorations;
                const ranges: number[] = [];
                const first = firstTrue(intervals.length, index => intervals[index].start > time);
                for (let i = first - 1; i >= 0 && latestEnd[i] > time; i--) {
                    const { segmentIdx, end } = intervals[i];
                    if (end <= time) continue;
                    for (const piece of sourceTextPieces(index, projection, index.starts[segmentIdx], index.starts[segmentIdx + 1])) {
                        if (piece.source.kind === "segment" && piece.source.index === segmentIdx) ranges.push(piece.utf16From + 1, piece.utf16To + 1);
                    }
                }
                previousTime = time;
                if (projection === previousProjection && ranges.length === previousRanges.length
                    && ranges.every((position, index) => position === previousRanges[index])) return previousDecorations;
                const decorations: Decoration[] = [];
                for (let i = 0; i < ranges.length; i += 2) decorations.push(Decoration.inline(ranges[i], ranges[i + 1], { class: "current" }));
                previousProjection = projection;
                previousRanges = ranges;
                previousDecorations = DecorationSet.create(state.doc, decorations);
                return previousDecorations;
            }
        }
    });
    return [compositionPlugin(), bridge, caretPlugin(), playback, history()];
}

export function transcriptExtensions(index: TextIndex, canEdit: () => boolean = () => true, initial = projectText(index, [])): Extensions {
    const source = Source.extend({
        renderHTML({ mark }) {
            if (mark.attrs.kind !== "segment") return ["span", { class: "transcript-text transcript-added" }, 0];
            const probability = index.transcript[mark.attrs.index].token.prob;
            const level = probabilityThresholds.findIndex(threshold => probability < threshold);
            return ["span", { class: `transcript-text token-prob-${level}` }, 0];
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
    if (inspection) editor.registerPlugin(informationPlugin(index, transcriptProjection, state => playbackKey.getState(state) ?? -1, inspection));
    editors.set(editor.view.dom, editor);
    return editor;
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

export function transcriptHistoryAvailable(element: HTMLElement | null, action: "undo" | "redo"): boolean | null {
    const editor = transcriptEditorAt(element);
    return editor ? editor.isEditable && (action === "undo" ? undo : redo)(editor.state) : null;
}

export function handleTranscriptEdit(element: HTMLElement | null, action: EditAction): boolean {
    if (action !== "selectAll" && action !== "undo" && action !== "redo") return false;
    const editor = transcriptEditorAt(element);
    if (!editor) return false;
    if (action === "selectAll") editor.commands.selectAll();
    else if (editor.isEditable) {
        (action === "undo" ? undo : redo)(editor.state, transaction => {
            // Undo can remove a focused event marker. Keep the next edit command inside this editor.
            if (document.activeElement !== editor.view.dom && editor.view.dom.contains(document.activeElement)) editor.view.focus();
            editor.view.dispatch(transaction);
        });
    }
    return true;
}

export function setTranscriptPlayback(editor: Editor, time: number): void {
    if (!editor.isDestroyed && playbackKey.getState(editor.state) !== time) {
        editor.view.dispatch(editor.state.tr.setMeta(playbackKey, time).setMeta("addToHistory", false));
    }
}