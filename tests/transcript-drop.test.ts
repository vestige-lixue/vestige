import { describe, expect, it, vi } from "vitest";
import { getSchema } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { undo, redo, undoDepth } from "@tiptap/pm/history";
import { type EditorView } from "@tiptap/pm/view";
import { transcriptContent, transcriptExtensions, transcriptPlugins, transcriptModifications, documentText } from "../renderer/editor/transcript";
import { createTextIndex } from "../shared/transcript/text";
import { transcript } from "./support/fixtures";

function editor(text = "A😀B\nCDEF", anchor = 4, head = 2): {
    view: EditorView;
    drop: (top: number, moved?: boolean, slice?: Slice, position?: number) => void;
} {
    const index = createTextIndex(transcript([text]));
    const schema = getSchema(transcriptExtensions(index));
    const plugins = transcriptPlugins(index);
    const initial = EditorState.create({ schema, doc: schema.nodeFromJSON(transcriptContent(index, [])), plugins });
    const bridge = plugins.find(plugin => plugin.props.handleDrop)!;
    const view = {
        state: initial.apply(initial.tr.setSelection(TextSelection.create(initial.doc, anchor, head))),
        editable: true,
        focus: vi.fn(),
        dom: {
            getBoundingClientRect: () => ({ left: 0, right: 200, top: 0, bottom: 300 }),
            firstElementChild: { getBoundingClientRect: () => ({ left: 28, right: 172, top: 28, bottom: 100, width: 144 }) }
        },
        posAtCoords: () => ({ pos: 1, inside: 0 }),
        dispatch(transaction: Transaction) {
            view.state = view.state.apply(transaction);
        }
    };
    return {
        view: view as unknown as EditorView,
        drop(top, moved = true, slice = view.state.selection.content(), position = 1) {
            view.posAtCoords = () => ({ pos: position, inside: 0 });
            const editorView = view as unknown as EditorView;
            const transformed = bridge.props.transformPasted!.call(bridge, slice, editorView, false);
            expect(bridge.props.handleDrop!.call(bridge, editorView, { clientX: 80, clientY: top } as DragEvent, transformed, moved)).toBe(true);
        }
    };
}

describe("transcript drop", () => {
    it.each([[12, "😀AB\nCDEF", 1], [250, "AB\nCDEF😀", 8]])("moves to whitespace at y=%i and restores source history and selection", (top, text, position) => {
        const value = editor(), before = value.view.state;
        value.drop(top);
        const after = value.view.state, modifications = transcriptModifications(after);
        expect(documentText(after.doc)).toBe(text);
        expect(after.selection).toMatchObject({ from: position, to: position + 2 });
        expect(undoDepth(after)).toBe(1);
        expect(undo(after, transaction => value.view.dispatch(transaction))).toBe(true);
        expect(value.view.state.doc.eq(before.doc)).toBe(true);
        expect(value.view.state.selection.eq(before.selection)).toBe(true);
        expect(transcriptModifications(value.view.state)).toEqual([]);
        expect(redo(value.view.state, transaction => value.view.dispatch(transaction))).toBe(true);
        expect(value.view.state.doc.eq(after.doc)).toBe(true);
        expect(value.view.state.selection.eq(after.selection)).toBe(true);
        expect(transcriptModifications(value.view.state)).toEqual(modifications);
    });

    it("copies into whitespace without removing the selected source", () => {
        const value = editor();
        value.drop(250, false);
        expect(documentText(value.view.state.doc)).toBe("A😀B\nCDEF😀");
        expect(value.view.state.selection).toMatchObject({ from: 10, to: 12 });
    });

    it("inserts external multiline text without replacing the existing selection", () => {
        const value = editor(), schema = value.view.state.schema;
        const slice = new Slice(Fragment.fromArray([schema.text("X"), schema.nodes.hardBreak.create(), schema.text("Y")]), 0, 0);
        value.drop(12, false, slice);
        expect(documentText(value.view.state.doc)).toBe("X\nYA😀B\nCDEF");
        expect(value.view.state.selection).toMatchObject({ from: 1, to: 4 });
    });

    it.each([2, 3, 4])("preserves history when moved onto source position %i", position => {
        const value = editor(), before = value.view.state;
        value.drop(60, true, undefined, position);
        expect(value.view.state).toBe(before);
        expect(undoDepth(value.view.state)).toBe(0);
    });

    it("allows a copy inside the source selection", () => {
        const value = editor("ABCDE", 2, 5);
        value.drop(60, false, undefined, 3);
        expect(documentText(value.view.state.doc)).toBe("ABBCDCDE");
        expect(value.view.state.selection).toMatchObject({ from: 3, to: 6 });
    });

    it("inserts into an empty transcript", () => {
        const value = editor("", 1, 1);
        value.drop(250, false, new Slice(Fragment.from(value.view.state.schema.text("A")), 0, 0));
        expect(documentText(value.view.state.doc)).toBe("A");
        expect(value.view.state.selection).toMatchObject({ from: 1, to: 2 });
    });

    it("ignores a drop outside the editor", () => {
        const value = editor(), before = value.view.state;
        value.drop(350);
        expect(value.view.state).toBe(before);
    });
});