import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { AllSelection, EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";
import { undo, undoDepth } from "@tiptap/pm/history";
import { informationPlugin, toggleSelectionDeletions } from "../renderer/editor/information";
import { transcriptContent, transcriptExtensions, transcriptPlugins, transcriptProjection, transcriptModifications, documentText } from "../renderer/editor/transcript";
import { createTextIndex, projectText } from "../shared/transcript/text";
import { transcript, modification } from "./support/fixtures";

function editor(text: string, removed = false): { view: EditorView; expanded: () => { from: number; to: number }[] } {
    const spans = transcript([text]), index = createTextIndex(spans);
    const modifications = removed ? modification(spans, 0, Array.from(text).length, "") : [];
    const projection = projectText(index, modifications);
    const schema = getSchema(transcriptExtensions(index));
    const information = informationPlugin(index, transcriptProjection, () => -1, { duration: 3, onChange: () => undefined, onSeek: () => undefined });
    const view = {
        state: EditorState.create({
            schema, doc: schema.nodeFromJSON(transcriptContent(index, modifications)),
            plugins: [...transcriptPlugins(index, () => true, projection), information]
        }),
        composing: false,
        editable: true,
        focus: () => undefined,
        dispatch(transaction: Transaction) {
            view.state = view.state.applyTransaction(transaction).state;
        }
    };
    return { view: view as unknown as EditorView, expanded: () => information.getState(view.state).expanded };
}

describe("transcript deletion shortcut", () => {
    it.each(["caret", "all"])("toggles deleted text with a %s without changing the document or history", selection => {
        const { view, expanded } = editor("A😀\nB", true);
        if (selection === "all") view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
        const before = view.state;
        for (const open of [true, false, true, false]) {
            expect(toggleSelectionDeletions(view)).toBe(true);
            expect(expanded()).toEqual(open ? [{ from: 0, to: 4 }] : []);
            expect(view.state.doc).toBe(before.doc);
            expect(view.state.selection.eq(before.selection)).toBe(true);
            expect(transcriptModifications(view.state)).toEqual(transcriptModifications(before));
            expect(undoDepth(view.state)).toBe(0);
        }
    });

    it("becomes available after deleting all text and keeps undo available", () => {
        const { view, expanded } = editor("ABC");
        view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)).deleteSelection());
        expect(documentText(view.state.doc)).toBe("");
        expect(view.state.selection.empty).toBe(true);
        expect(toggleSelectionDeletions(view)).toBe(true);
        expect(expanded()).toEqual([{ from: 0, to: 3 }]);
        expect(toggleSelectionDeletions(view)).toBe(true);
        expect(expanded()).toEqual([]);
        expect(undoDepth(view.state)).toBe(1);
        expect(undo(view.state, transaction => view.dispatch(transaction))).toBe(true);
        expect(documentText(view.state.doc)).toBe("ABC");
        expect(transcriptModifications(view.state)).toEqual([]);
        expect(toggleSelectionDeletions(view)).toBe(false);
    });

    it("does not toggle a deletion away from the caret", () => {
        const { view, expanded } = editor("ABC");
        view.dispatch(view.state.tr.delete(1, 2));
        expect(documentText(view.state.doc)).toBe("BC");
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
        expect(toggleSelectionDeletions(view)).toBe(false);
        expect(expanded()).toEqual([]);
        view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
        expect(toggleSelectionDeletions(view)).toBe(true);
        expect(expanded()).toEqual([{ from: 0, to: 1 }]);
    });

    it.each([
        { text: "XABYCDZ", middle: 4, end: 7, positions: [1, 3, 5] },
        { text: "X😀BYCDZ", middle: 5, end: 8, positions: [1, 4, 6] }
    ])("toggles only the marker at the caret in $text", ({ text, middle, end, positions }) => {
        const { view, expanded } = editor(text);
        view.dispatch(view.state.tr.delete(end, end + 1).delete(middle, middle + 1).delete(1, 2));
        const ranges = [{ from: 0, to: 1 }, { from: 3, to: 4 }, { from: 6, to: 7 }];
        const before = view.state;
        for (const [i, position] of positions.entries()) {
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
            for (const open of [true, false, true, false]) {
                expect(toggleSelectionDeletions(view)).toBe(true);
                expect(expanded()).toEqual(open ? [ranges[i]] : []);
                expect(view.state.selection).toMatchObject({ anchor: position, head: position });
                expect(view.state.doc).toBe(before.doc);
                expect(transcriptModifications(view.state)).toEqual(transcriptModifications(before));
                expect(undoDepth(view.state)).toBe(1);
            }
        }
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, positions[0])));
        toggleSelectionDeletions(view);
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, positions[1])));
        toggleSelectionDeletions(view);
        expect(expanded()).toEqual([ranges[0], ranges[1]]);
        toggleSelectionDeletions(view);
        expect(expanded()).toEqual([ranges[0]]);
        view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
        toggleSelectionDeletions(view);
        expect(expanded()).toEqual(ranges);
        toggleSelectionDeletions(view);
        expect(expanded()).toEqual([]);
    });

    it.each([
        { text: "XABYCVDZEFW", start: 3, end: 5 },
        { text: "XA😀YCVDZEFW", start: 4, end: 6 }
    ])("includes both selection edges and interior markers in $text", ({ text, start, end }) => {
        const { view, expanded } = editor(text);
        const transaction = view.state.tr;
        for (const marker of ["W", "Z", "V", "Y", "X"]) {
            const position = text.indexOf(marker) + 1;
            transaction.delete(position, position + 1);
        }
        view.dispatch(transaction);
        const ranges = [{ from: 3, to: 4 }, { from: 5, to: 6 }, { from: 7, to: 8 }];
        for (const reversed of [false, true]) {
            for (const selection of [
                { from: end, to: end + 1, expected: [ranges[2]] },
                { from: 2, to: start, expected: [ranges[0]] },
                { from: start, to: end, expected: ranges }
            ]) {
                const { from, to, expected } = selection;
                view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, reversed ? to : from, reversed ? from : to)));
                const before = view.state;
                for (const open of [true, false]) {
                    expect(toggleSelectionDeletions(view)).toBe(true);
                    expect(expanded()).toEqual(open ? expected : []);
                    expect(view.state.selection.eq(before.selection)).toBe(true);
                    expect(view.state.doc).toBe(before.doc);
                    expect(transcriptModifications(view.state)).toEqual(transcriptModifications(before));
                    expect(undoDepth(view.state)).toBe(undoDepth(before));
                }
            }
        }
    });

    it("opens a partially expanded selection before collapsing it and preserves outside markers", () => {
        const { view, expanded } = editor("XABYCVDZEFW");
        view.dispatch(view.state.tr.delete(11, 12).delete(8, 9).delete(6, 7).delete(4, 5).delete(1, 2));
        const outside = [{ from: 0, to: 1 }, { from: 10, to: 11 }];
        for (const position of [1, 7, 3]) {
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
            expect(toggleSelectionDeletions(view)).toBe(true);
        }
        expect(expanded()).toEqual([...outside, { from: 3, to: 4 }]);
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3, 5)));
        expect(toggleSelectionDeletions(view)).toBe(true);
        expect(expanded()).toEqual([...outside, { from: 3, to: 4 }, { from: 5, to: 6 }, { from: 7, to: 8 }]);
        expect(toggleSelectionDeletions(view)).toBe(true);
        expect(expanded()).toEqual(outside);
    });

    it("includes a replacement's deletion when only the end of its replacement text is selected", () => {
        const { view, expanded } = editor("ABCD");
        view.dispatch(view.state.tr.insertText("XY", 2, 4));
        expect(documentText(view.state.doc)).toBe("AXYD");
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3, 4)));
        expect(toggleSelectionDeletions(view)).toBe(true);
        expect(expanded()).toEqual([{ from: 1, to: 3 }]);
        expect(toggleSelectionDeletions(view)).toBe(true);
        expect(expanded()).toEqual([]);
    });

    it.each(["caret", "all"])("leaves a genuinely empty document unchanged with a %s", selection => {
        const { view, expanded } = editor("");
        if (selection === "all") view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
        const before = view.state;
        expect(toggleSelectionDeletions(view)).toBe(false);
        expect(expanded()).toEqual([]);
        expect(view.state.doc).toBe(before.doc);
        expect(view.state.selection.eq(before.selection)).toBe(true);
        expect(undoDepth(view.state)).toBe(0);
    });
});