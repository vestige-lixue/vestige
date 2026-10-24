import { Editor, Extension, Mark, Node, type Extensions, type JSONContent } from "@tiptap/core";
import { Fragment, Slice, type Node as PMNode, type Mark as PMMark, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { DocAttrStep } from "@tiptap/pm/transform";
import { history, undo, redo } from "@tiptap/pm/history";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { type Modification } from "../../shared/Vestige";
import { type Run } from "../../shared/transcription/Run";
import { type EditAction } from "../../shared/app";
import { informationPlugin, type InspectionOptions } from "./information";
import {
    createTextIndex, projectText, editText, utf16ToCodepoint,
    type TextIndex, type TextProjection
} from "../../shared/transcript/text";

const patchesAttribute = "vestigeModifications";
const bridgeKey = new PluginKey("vestigeTranscript");
const playbackKey = new PluginKey<number>("vestigePlayback");
const probabilityThresholds = [0.2, 0.4, 0.6, 0.8, Infinity];
const editors = new WeakMap<HTMLElement, Editor>();
const projections = new WeakMap<PMNode, TextProjection>();
const texts = new WeakMap<PMNode, string>();
// Keep one canonical input per Run, rather than retaining a full projection for every history snapshot.
const projectionInputs = new WeakMap<TextIndex, { modifications: readonly Modification[]; projection: TextProjection }>();

const Document = Node.create({
    name: "doc", topNode: true, content: "paragraph",
    addAttributes() {
        return { [patchesAttribute]: { default: [], rendered: false } };
    }
});

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

export function transcriptContent(index: TextIndex, modifications: readonly Modification[]): JSONContent {
    const projection = projectText(index, modifications);
    projectionInputs.set(index, { modifications: projection.modifications, projection });
    return {
        type: "doc", attrs: { [patchesAttribute]: projection.modifications },
        content: [{ type: "paragraph", content: projection.pieces.flatMap(piece => inlineContent(piece.text, [{ type: "source", attrs: piece.source }])) }]
    };
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
            projection = editText(index, projection, utf16ToCodepoint(before, change.from), utf16ToCodepoint(before, change.to), after.slice(change.start, change.end));
        }
        if (projection.text !== after) throw new Error("Transcript transaction did not preserve rendered text.");
    }
    return projection;
}

function synchronizeMarks(transaction: Transaction, projection: TextProjection): void {
    let position = 1;
    const spans: { from: number; to: number; mark: PMMark }[] = [];
    for (const piece of projection.pieces) {
        const from = position;
        const to = from + piece.text.length;
        position = to;
        if (from === to) continue;
        spans.push({ from, to, mark: transaction.doc.type.schema.marks.source.create(piece.source) });
    }
    const changes: typeof spans = [];
    let first = 0;
    // Walk the inline nodes once. Searching the whole paragraph separately for each token is quadratic.
    transaction.doc.descendants((node, from) => {
        if (!node.isInline) return;
        const to = from + node.nodeSize;
        while (first < spans.length && spans[first].to <= from) first++;
        for (let i = first; i < spans.length && spans[i].from < to; i++) {
            const span = spans[i];
            if (!span.mark.isInSet(node.marks)) {
                const start = Math.max(from, span.from);
                const end = Math.min(to, span.to);
                const previous = changes.at(-1);
                // A pasted piece can span many text and hardBreak nodes with the same source mark.
                if (previous && previous.to === start && previous.mark.eq(span.mark)) previous.to = end;
                else changes.push({ from: start, to: end, mark: span.mark });
            }
        }
    });
    for (const change of changes) {
        transaction.removeMark(change.from, change.to, change.mark.type);
        transaction.addMark(change.from, change.to, change.mark);
    }
}

function rememberProjection(index: TextIndex, doc: PMNode, projection: TextProjection): void {
    projections.set(doc, projection);
    // During composition the document can still carry the previous persisted snapshot.
    if (doc.attrs[patchesAttribute] === projection.modifications) {
        projectionInputs.set(index, { modifications: projection.modifications, projection });
    }
}

function projectionOf(index: TextIndex, doc: PMNode): TextProjection {
    let projection = projections.get(doc);
    if (!projection) {
        const modifications = doc.attrs[patchesAttribute] as Modification[];
        const previous = projectionInputs.get(index);
        projection = previous?.modifications === modifications ? previous.projection : projectText(index, modifications);
        projections.set(doc, projection);
        projectionInputs.set(index, { modifications, projection });
    }
    return projection;
}

export function transcriptPlugins(index: TextIndex, canEdit: () => boolean = () => true): Plugin[] {
    let composing = false;
    let compositionTimer: ReturnType<typeof setTimeout> | undefined;
    const bridge = new Plugin({
        key: bridgeKey,
        filterTransaction(transaction) {
            return (!transaction.docChanged || canEdit()) && transaction.doc.childCount === 1 && transaction.doc.firstChild?.type.name === "paragraph";
        },
        appendTransaction(transactions, oldState, newState) {
            if (!transactions.some(transaction => transaction.getMeta(bridgeKey) === "compositionend"
                || transaction.docChanged && !transaction.getMeta(bridgeKey))) return null;
            let projection = projectionOf(index, oldState.doc);
            for (const transaction of transactions) {
                if (transaction.steps.some(step => step instanceof DocAttrStep && step.attr === patchesAttribute)) {
                    // History restores the exact patch snapshot, rather than interpreting undo as a new edit.
                    projection = projectionOf(index, transaction.doc);
                }
                else if (!transaction.getMeta(bridgeKey)) projection = applyTextSteps(index, projection, transaction);
            }
            if (projection.text !== documentText(newState.doc)) throw new Error("Transcript and modifications diverged.");
            rememberProjection(index, newState.doc, projection);
            // Updating document attributes redraws the editor; changing marks also replaces IME-owned DOM.
            if (composing) return null;
            const transaction = newState.tr.setMeta(bridgeKey, true);
            const current = newState.doc.attrs[patchesAttribute] as Modification[];
            if (JSON.stringify(current) !== JSON.stringify(projection.modifications)) transaction.setDocAttribute(patchesAttribute, projection.modifications);
            synchronizeMarks(transaction, projection);
            rememberProjection(index, transaction.doc, projection);
            return transaction.steps.length ? transaction : null;
        },
        view() {
            return { destroy: () => clearTimeout(compositionTimer) };
        },
        props: {
            handleKeyDown(view, event) {
                if (event.defaultPrevented || event.isComposing || view.composing || event.altKey || event.metaKey) return false;
                const { selection, doc } = view.state;
                const end = doc.content.size - 1;
                // Navigate directly to the text endpoint, before the browser crosses trailing widgets.
                if (event.key === "End" && event.ctrlKey && !event.shiftKey) {
                    view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, end)).scrollIntoView());
                    return true;
                }
                if (!selection.empty || selection.head !== end) return false;
                if (event.key !== "End" && (event.key !== "ArrowRight" || !view.endOfTextblock("right"))) return false;
                // Do not let a no-op navigation move the DOM caret across trailing widgets.
                view.dispatch(view.state.tr.scrollIntoView());
                return true;
            },
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
                compositionstart() {
                    clearTimeout(compositionTimer);
                    composing = true;
                    return false;
                },
                compositionend(view) {
                    // Let ProseMirror consume the final DOM input before persisting and restyling it.
                    compositionTimer = setTimeout(() => {
                        if (view.isDestroyed || view.composing) return;
                        composing = false;
                        view.dispatch(view.state.tr.setMeta(bridgeKey, "compositionend"));
                    }, 0);
                    return false;
                },
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
                const projection = projectionOf(index, state.doc);
                if (projection === previousProjection && time === previousTime) return previousDecorations;
                const ranges: number[] = [];
                let position = 1;
                for (const piece of projection.pieces) {
                    const from = position;
                    position += piece.text.length;
                    if (!piece.text) continue;
                    if (piece.source.kind === "segment") {
                        const range = index.transcript[piece.source.index].range;
                        if (time >= range.start && time < range.end) ranges.push(from, position);
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
    return [bridge, playback, history()];
}

export function transcriptExtensions(index: TextIndex, canEdit: () => boolean = () => true): Extensions {
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
            return transcriptPlugins(index, canEdit);
        },
        addKeyboardShortcuts() {
            const lineBreak = (): boolean => this.editor.commands.command(({ tr, dispatch }) => {
                if (dispatch) tr.replaceSelectionWith(this.editor.schema.nodes.hardBreak.create()).scrollIntoView();
                return true;
            });
            return {
                Enter: lineBreak, "Shift-Enter": lineBreak, "Mod-Enter": lineBreak,
                "Mod-z": () => undo(this.editor.state, transaction => this.editor.view.dispatch(transaction)),
                "Mod-Shift-z": () => redo(this.editor.state, transaction => this.editor.view.dispatch(transaction)),
                "Mod-y": () => redo(this.editor.state, transaction => this.editor.view.dispatch(transaction))
            };
        }
    });
    return [Document, Paragraph, Text, HardBreak, source, bridge];
}

export function createTranscriptEditor(element: HTMLElement, run: Run, modifications: readonly Modification[], onChange: (modifications: Modification[]) => void, canEdit: () => boolean = () => true, inspection?: InspectionOptions): Editor {
    const index = createTextIndex(run.transcript);
    let previous: Modification[];
    const editor = new Editor({
        element, extensions: transcriptExtensions(index, canEdit), content: transcriptContent(index, modifications),
        injectCSS: false, enableInputRules: false, enablePasteRules: false,
        onTransaction({ editor }) {
            const next = editor.state.doc.attrs[patchesAttribute] as Modification[];
            if (next === previous) return;
            previous = next;
            onChange(next);
        }
    });
    previous = editor.state.doc.attrs[patchesAttribute];
    if (inspection) editor.registerPlugin(informationPlugin(index, doc => projectionOf(index, doc), inspection));
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
        (action === "undo" ? undo : redo)(editor.state, transaction => editor.view.dispatch(transaction));
    }
    return true;
}

export function setTranscriptPlayback(editor: Editor, time: number): void {
    if (!editor.isDestroyed && playbackKey.getState(editor.state) !== time) {
        editor.view.dispatch(editor.state.tr.setMeta(playbackKey, time).setMeta("addToHistory", false));
    }
}