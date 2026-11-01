import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { AllSelection, EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { closeHistory, undo, redo, undoDepth, redoDepth } from "@tiptap/pm/history";
import { transcriptContent, transcriptExtensions, transcriptPlugins, transcriptProjection, transcriptModifications, documentText } from "../renderer/editor/transcript";
import { createTextIndex } from "../shared/transcript/text";
import { transcript } from "./support/fixtures";

function editor(text: string): {
    state: () => EditorState;
    apply: (transaction: Transaction) => void;
    select: (anchor: number, head?: number) => void;
    history: (action: "undo" | "redo") => boolean;
} {
    const index = createTextIndex(transcript([text]));
    const schema = getSchema(transcriptExtensions(index));
    let state = EditorState.create({ schema, doc: schema.nodeFromJSON(transcriptContent(index, [])), plugins: transcriptPlugins(index) });
    function apply(transaction: Transaction): void {
        state = state.apply(transaction);
        expect(transcriptProjection(state).text).toBe(documentText(state.doc));
    }
    return {
        state: () => state,
        apply,
        select: (anchor, head = anchor) => apply(state.tr.setSelection(TextSelection.create(state.doc, anchor, head))),
        history: action => (action === "undo" ? undo : redo)(state, apply)
    };
}

describe("transcript history selection", () => {
    it.each([[5, 5], [4, 7], [7, 4]])("keeps the current anchor %i and head %i through undo and redo", (anchor, head) => {
        const value = editor("abcdefghij");
        value.apply(value.state().tr.insertText("XY", 2));
        const modifications = transcriptModifications(value.state());
        value.select(anchor, head);
        expect(value.history("undo")).toBe(true);
        expect(documentText(value.state().doc)).toBe("abcdefghij");
        expect(value.state().selection).toMatchObject({ anchor, head });
        expect(transcriptModifications(value.state())).toEqual([]);
        expect(undoDepth(value.state())).toBe(0);
        expect(redoDepth(value.state())).toBe(1);
        expect(value.history("redo")).toBe(true);
        expect(documentText(value.state().doc)).toBe("aXYbcdefghij");
        expect(value.state().selection).toMatchObject({ anchor, head });
        expect(transcriptModifications(value.state())).toEqual(modifications);
        expect(undoDepth(value.state())).toBe(1);
        expect(redoDepth(value.state())).toBe(0);
    });

    it("uses the selection moved after undo when redoing a replacement", () => {
        const value = editor("abcdefghij");
        value.select(2, 5);
        value.apply(value.state().tr.insertText("XYZ"));
        value.select(9, 7);
        value.history("undo");
        expect(value.state().selection).toMatchObject({ anchor: 9, head: 7 });
        value.select(6);
        value.history("redo");
        expect(documentText(value.state().doc)).toBe("aXYZefghij");
        expect(value.state().selection).toMatchObject({ anchor: 6, head: 6 });
    });

    it.each([[4, 9, 4, 7], [9, 4, 7, 4], [9, 9, 7, 7]])("clamps only out-of-range endpoints %i/%i when undo shortens the text", (anchor, head, nextAnchor, nextHead) => {
        const value = editor("abcdef");
        value.apply(value.state().tr.insertText("XYZ", 7));
        value.select(anchor, head);
        value.history("undo");
        expect(documentText(value.state().doc)).toBe("abcdef");
        expect(value.state().selection).toMatchObject({ anchor: nextAnchor, head: nextHead });
        value.history("redo");
        expect(documentText(value.state().doc)).toBe("abcdefXYZ");
        expect(value.state().selection).toMatchObject({ anchor: nextAnchor, head: nextHead });
    });

    it("clamps the current reverse selection when redo shortens the text", () => {
        const value = editor("abcdefghij");
        value.apply(value.state().tr.delete(4, 11));
        value.select(2);
        value.history("undo");
        expect(value.state().selection).toMatchObject({ anchor: 2, head: 2 });
        value.select(9, 2);
        value.history("redo");
        expect(documentText(value.state().doc)).toBe("abc");
        expect(value.state().selection).toMatchObject({ anchor: 4, head: 2 });
    });

    it("keeps the same selected text range when undo grows a fully selected document", () => {
        const value = editor("abcdef");
        value.apply(value.state().tr.delete(4, 7));
        value.apply(value.state().tr.setSelection(new AllSelection(value.state().doc)));
        value.history("undo");
        expect(documentText(value.state().doc)).toBe("abcdef");
        expect(value.state().selection).toMatchObject({ anchor: 1, head: 4 });
        value.history("redo");
        expect(documentText(value.state().doc)).toBe("abc");
        expect(value.state().selection).toMatchObject({ anchor: 1, head: 4 });
    });

    it("keeps a valid caret when undo empties the document and redo restores it", () => {
        const value = editor("");
        value.apply(value.state().tr.insertText("hello"));
        value.select(6);
        value.history("undo");
        expect(documentText(value.state().doc)).toBe("");
        expect(value.state().selection).toMatchObject({ anchor: 1, head: 1 });
        value.history("redo");
        expect(documentText(value.state().doc)).toBe("hello");
        expect(value.state().selection).toMatchObject({ anchor: 1, head: 1 });
    });

    it("preserves a reverse selection across line breaks and emoji through multiple history entries", () => {
        const value = editor("a😀b\ncdefgh");
        value.apply(value.state().tr.insertText("X", 2));
        value.apply(closeHistory(value.state().tr).insertText("Y", 2));
        value.select(9, 5);
        for (const action of ["undo", "undo", "redo", "redo"] as const) {
            expect(value.history(action)).toBe(true);
            expect(value.state().selection).toMatchObject({ anchor: 9, head: 5 });
        }
        expect(documentText(value.state().doc)).toBe("aYX😀b\ncdefgh");
        expect(undoDepth(value.state())).toBe(2);
        expect(redoDepth(value.state())).toBe(0);
    });

    it("leaves ordinary typing and empty history behavior intact", () => {
        const value = editor("abcdef");
        value.select(2, 4);
        const state = value.state();
        expect(value.history("undo")).toBe(false);
        expect(value.history("redo")).toBe(false);
        expect(value.state()).toBe(state);
        value.apply(value.state().tr.insertText("X"));
        expect(documentText(value.state().doc)).toBe("aXdef");
        expect(value.state().selection).toMatchObject({ anchor: 3, head: 3 });
    });
});