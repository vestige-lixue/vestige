import { Editor, Extension, Mark, Node, type Extensions, type JSONContent } from "@tiptap/core";
import { Fragment, Slice, type Node as PMNode, type Mark as PMMark, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { DocAttrStep } from "@tiptap/pm/transform";
import { history, undo, redo } from "@tiptap/pm/history";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { type Modification } from "../../shared/Vestige";
import { type Run } from "../../shared/transcription/Run";
import { type EditAction } from "../../shared/app";
import {
    createTextIndex, projectText, editText, codepointToUtf16, utf16ToCodepoint, pieceTime,
    type TextIndex, type TextProjection
} from "../../shared/transcript/text";

const patchesAttribute = "vestigeModifications";
const bridgeKey = new PluginKey("vestigeTranscript");
const playbackKey = new PluginKey<number>("vestigePlayback");
const editors = new WeakMap<HTMLElement, Editor>();

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
    return doc.firstChild!.textBetween(0, doc.firstChild!.content.size, "", "\n");
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
        const before = documentText(transaction.docs[i]);
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
        // Normalize surrogate boundaries before applying ranges, including maps produced by DOM diffs.
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
            if (!span.mark.isInSet(node.marks)) changes.push({ from: Math.max(from, span.from), to: Math.min(to, span.to), mark: span.mark });
        }
    });
    for (const change of changes) {
        transaction.removeMark(change.from, change.to, change.mark.type);
        transaction.addMark(change.from, change.to, change.mark);
    }
}

export function transcriptPlugins(index: TextIndex, canEdit: () => boolean = () => true): Plugin[] {
    const projections = new WeakMap<PMNode, TextProjection>();
    function projectionOf(doc: PMNode): TextProjection {
        let projection = projections.get(doc);
        if (!projection) {
            projection = projectText(index, doc.attrs[patchesAttribute]);
            projections.set(doc, projection);
        }
        return projection;
    }
    const bridge = new Plugin({
        key: bridgeKey,
        filterTransaction(transaction) {
            return (!transaction.docChanged || canEdit()) && transaction.doc.childCount === 1 && transaction.doc.firstChild?.type.name === "paragraph";
        },
        appendTransaction(transactions, oldState, newState) {
            if (!transactions.some(transaction => transaction.docChanged && !transaction.getMeta(bridgeKey))) return null;
            let projection = projectionOf(oldState.doc);
            for (const transaction of transactions) {
                if (transaction.steps.some(step => step instanceof DocAttrStep && step.attr === patchesAttribute)) {
                    // History restores the exact patch snapshot, rather than interpreting undo as a new edit.
                    projection = projectionOf(transaction.doc);
                }
                else if (!transaction.getMeta(bridgeKey)) projection = applyTextSteps(index, projection, transaction);
            }
            if (projection.text !== documentText(newState.doc)) throw new Error("Transcript and modifications diverged.");
            const transaction = newState.tr.setMeta(bridgeKey, true);
            const current = newState.doc.attrs[patchesAttribute] as Modification[];
            if (JSON.stringify(current) !== JSON.stringify(projection.modifications)) transaction.setDocAttribute(patchesAttribute, projection.modifications);
            synchronizeMarks(transaction, projection);
            projections.set(transaction.doc, projection);
            return transaction.steps.length ? transaction : null;
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
                    if (!view.editable || event.isComposing || !["insertParagraph", "insertLineBreak"].includes(event.inputType)) return false;
                    event.preventDefault();
                    view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.hardBreak.create()).scrollIntoView());
                    return true;
                }
            }
        }
    });
    const playback = new Plugin<number>({
        key: playbackKey,
        state: { init: () => -1, apply: (transaction, time) => transaction.getMeta(playbackKey) ?? time },
        props: {
            decorations(state) {
                const time = playbackKey.getState(state) ?? -1;
                const projection = projectionOf(state.doc);
                const decorations: Decoration[] = [];
                let position = 1;
                for (const piece of projection.pieces) {
                    const from = position;
                    position += piece.text.length;
                    if (!piece.text) continue;
                    if (piece.source.kind === "segment") {
                        const range = index.transcript[piece.source.index].range;
                        if (time >= range.start && time < range.end) decorations.push(Decoration.inline(from, position, { class: "current" }));
                    }
                    else {
                        const range = pieceTime(index, piece);
                        if (!range || time < range.start || time >= range.end) continue;
                        const offset = Math.min(piece.to - piece.from - 1, Math.floor((time - range.start) / (range.end - range.start) * (piece.to - piece.from)));
                        decorations.push(Decoration.inline(from + codepointToUtf16(piece.text, offset), from + codepointToUtf16(piece.text, offset + 1), { class: "current" }));
                    }
                }
                return DecorationSet.create(state.doc, decorations);
            }
        }
    });
    return [bridge, playback, history()];
}

export function transcriptExtensions(index: TextIndex, canEdit: () => boolean = () => true): Extensions {
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
    return [Document, Paragraph, Text, HardBreak, Source, bridge];
}

export function createTranscriptEditor(element: HTMLElement, run: Run, modifications: readonly Modification[], onChange: (modifications: Modification[]) => void, canEdit: () => boolean = () => true): Editor {
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
    editors.set(editor.view.dom, editor);
    return editor;
}

export function handleTranscriptEdit(element: HTMLElement | null, action: EditAction): boolean {
    if (action !== "undo" && action !== "redo") return false;
    for (let current = element; current; current = current.parentElement) {
        const editor = editors.get(current);
        if (!editor || editor.isDestroyed) continue;
        if (editor.isEditable) {
            (action === "undo" ? undo : redo)(editor.state, transaction => editor.view.dispatch(transaction));
        }
        return true;
    }
    return false;
}

export function setTranscriptPlayback(editor: Editor, time: number): void {
    if (!editor.isDestroyed && playbackKey.getState(editor.state) !== time) {
        editor.view.dispatch(editor.state.tr.setMeta(playbackKey, time).setMeta("addToHistory", false));
    }
}