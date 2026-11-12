import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { AllSelection, EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { closeHistory, undo, redo, undoDepth, redoDepth } from "@tiptap/pm/history";
import { transcriptContent, transcriptExtensions, transcriptPlugins, transcriptProjection, transcriptModifications, documentText, applyTranscriptVocabulary, replaceTranscriptRanges } from "../renderer/editor/transcript";
import { findOccurrences, preserveReplacementCase } from "../shared/transcript/find";
import { projectionTransaction } from "../renderer/editor/projectionStep";
import { createTextIndex, editText, alignText, restoreTextDeletion, textReplacement, replaceText } from "../shared/transcript/text";
import { vocabularyRuleIssue } from "../shared/vocabulary/Vocabulary";
import { transcript } from "./support/fixtures";
import { rule } from "./support/vocabulary";
import { VocabularyIndex } from "../shared/vocabulary/match";
import { transcriptSelectionUnits } from "../renderer/editor/informationModel";

function editor(text: string | string[]): {
    state: () => EditorState;
    apply: (transaction: Transaction) => void;
    select: (anchor: number, head?: number) => void;
    history: (action: "undo" | "redo") => boolean;
} {
    const index = createTextIndex(transcript(typeof text === "string" ? [text] : text));
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

function vocabularyRequest(value: ReturnType<typeof editor>): Parameters<typeof applyTranscriptVocabulary>[0] {
    const view = {
        state: value.state(), isDestroyed: false, editable: true, composing: false, dom: { closest: () => null },
        dispatch(transaction: Transaction) {
            value.apply(transaction);
            view.state = value.state();
        }
    };
    return { view, doc: view.state.doc, selection: view.state.selection } as Parameters<typeof applyTranscriptVocabulary>[0];
}

describe("transcript history selection", () => {
    it("restores the moved range beside an existing deletion through undo and redo", () => {
        const value = editor("暖かく感じました。"), index = createTextIndex(transcript(["暖かく感じました。"]));
        value.apply(value.state().tr.delete(9, 10));
        value.select(3, 7);
        const state = value.state(), slice = state.selection.content(), transaction = closeHistory(state.tr).deleteSelection();
        const position = transaction.mapping.map(9);
        transaction.replaceRange(position, position, slice).setSelection(TextSelection.create(transaction.doc, position, position + 4));
        value.apply(transaction.setMeta("uiEvent", "drop"));
        const units = (): ReturnType<typeof transcriptSelectionUnits> => {
            const state = value.state();
            return transcriptSelectionUnits(index, transcriptProjection(state), 1, state.selection.from - 1, state.selection.to - 1);
        };
        expect(documentText(value.state().doc)).toBe("暖かしたく感じま");
        expect(units().deletions.map(item => item.original)).toEqual(["。"]);
        value.history("undo");
        expect(value.state().selection).toMatchObject({ anchor: 3, head: 7 });
        expect(units().deletions).toEqual([]);
        value.history("redo");
        expect(units().deletions.map(item => item.original)).toEqual(["。"]);
        value.select(1, value.state().doc.content.size - 1);
        expect(units().deletions.map(item => item.original)).toEqual(["く感じま", "。"]);
    });

    it.each([[2, 6, 8], [6, 2, 8], [8, 12, 1]])("restores moved text and its selection after a bridged drop from %i/%i to %i", (anchor, head, target) => {
        const value = editor("暖かく感じました。\n今日は暖かい");
        value.select(anchor + 1, head + 1);
        const before = value.state(), from = Math.min(anchor, head), to = Math.max(anchor, head);
        const text = documentText(before.doc).slice(from, to), slice = before.selection.content();
        const transaction = before.tr.deleteSelection(), position = transaction.mapping.map(target + 1);
        transaction.replaceRange(position, position, slice);
        transaction.setSelection(TextSelection.create(transaction.doc, position, position + to - from));
        value.apply(transaction.setMeta("uiEvent", "drop"));
        const after = value.state(), modifications = transcriptModifications(after);
        expect(documentText(after.doc).slice(after.selection.from - 1, after.selection.to - 1)).toBe(text);
        expect(undoDepth(after)).toBe(1);
        expect(value.history("undo")).toBe(true);
        expect(value.state().doc.eq(before.doc)).toBe(true);
        expect(transcriptModifications(value.state())).toEqual([]);
        expect(value.state().selection.eq(before.selection)).toBe(true);
        expect(documentText(value.state().doc).slice(value.state().selection.from - 1, value.state().selection.to - 1)).toBe(text);
        expect(value.history("redo")).toBe(true);
        expect(value.state().doc.eq(after.doc)).toBe(true);
        expect(value.state().selection.eq(after.selection)).toBe(true);
        expect(transcriptModifications(value.state())).toEqual(modifications);
    });

    it("undoes different case-preserved replacement lengths together with their exact source marks", () => {
        const value = editor(["CAT", " cat", " Cat"]);
        const before = value.state().doc;
        const text = documentText(before);
        const ranges = findOccurrences(text, "cat").map(range => ({ ...range, text: preserveReplacementCase(text.slice(range.from, range.to), "ß") }));
        expect(replaceTranscriptRanges(vocabularyRequest(value).view, ranges)).toBe(true);
        expect(documentText(value.state().doc)).toBe("SS ß SS");
        expect(undoDepth(value.state())).toBe(1);
        const after = value.state().doc, modifications = transcriptModifications(value.state());
        value.history("undo");
        expect(value.state().doc.eq(before)).toBe(true);
        expect(transcriptModifications(value.state())).toEqual([]);
        value.history("redo");
        expect(value.state().doc.eq(after)).toBe(true);
        expect(transcriptModifications(value.state())).toEqual(modifications);
    });

    it("replaces case-insensitive find hits as one explicit write and preserves provenance when the text stays equal", () => {
        const value = editor("Cat 😀cat cat.");
        value.apply(value.state().tr.insertText("前", 1));
        const before = transcriptProjection(value.state());
        const ranges = findOccurrences(before.text, "cat");
        expect(replaceTranscriptRanges(vocabularyRequest(value).view, ranges.map(range => ({ ...range, text: "cat" })))).toBe(true);
        expect(documentText(value.state().doc)).toBe("前cat 😀cat cat.");
        expect(undoDepth(value.state())).toBe(2);
        const written = transcriptModifications(value.state());
        expect(written.filter(item => item.type === "delete")).toHaveLength(3);
        value.apply(value.state().tr.insertText("后", value.state().doc.content.size - 1));
        expect(undoDepth(value.state())).toBe(3);
        value.history("undo");
        expect(transcriptModifications(value.state())).toEqual(written);
        value.history("undo");
        expect(transcriptProjection(value.state()).text).toBe(before.text);
        expect(transcriptModifications(value.state())).toEqual(before.modifications);
        value.history("redo");
        expect(transcriptModifications(value.state())).toEqual(written);
    });

    it.each([["新词", "甲新词丙丁"], ["", "甲丙丁"]])("applies vocabulary replacement %j across added text and Unicode as an isolated undo entry", (replacement, expected) => {
        const value = editor("甲乙😀丙丁");
        value.apply(value.state().tr.insertText("新增", 2));
        value.select(2, 7);
        const before = transcriptProjection(value.state());
        const request = vocabularyRequest(value);
        const match = { ranges: [{ from: 1, to: 6 }], rule: rule("新增乙😀", replacement) };
        expect(vocabularyRuleIssue(match.rule)).toBeNull();
        expect(applyTranscriptVocabulary(request, match)).toBe(true);
        expect(documentText(value.state().doc)).toBe(expected);
        expect(undoDepth(value.state())).toBe(2);
        const replaced = transcriptModifications(value.state());
        expect(applyTranscriptVocabulary(request, match)).toBe(false);
        value.apply(value.state().tr.insertText("!"));
        expect(undoDepth(value.state())).toBe(3);
        value.history("undo");
        expect(documentText(value.state().doc)).toBe(expected);
        value.history("undo");
        expect(documentText(value.state().doc)).toBe(before.text);
        expect(transcriptModifications(value.state())).toEqual(before.modifications);
        value.history("redo");
        expect(documentText(value.state().doc)).toBe(expected);
        expect(transcriptModifications(value.state())).toEqual(replaced);
    });

    it("undoes and redoes all vocabulary occurrences together, including their original modifications", () => {
        const value = editor("甲😀隔甲😀末");
        value.apply(value.state().tr.insertText("甲😀", 1));
        const before = transcriptProjection(value.state());
        value.select(before.text.length + 1, 1);
        const request = vocabularyRequest(value);
        const [group] = new VocabularyIndex([rule("甲😀", "乙")]).replacements(before.text, 0, before.text.length);
        expect(group.ranges).toHaveLength(3);
        expect(applyTranscriptVocabulary(request, group)).toBe(true);
        expect(documentText(value.state().doc)).toBe("乙乙隔乙末");
        const after = transcriptModifications(value.state());
        expect(undoDepth(value.state())).toBe(2);
        value.apply(value.state().tr.insertText("!"));
        expect(undoDepth(value.state())).toBe(3);
        value.history("undo");
        expect(transcriptModifications(value.state())).toEqual(after);
        value.history("undo");
        expect(documentText(value.state().doc)).toBe(before.text);
        expect(transcriptModifications(value.state())).toEqual(before.modifications);
        value.history("redo");
        expect(documentText(value.state().doc)).toBe("乙乙隔乙末");
        expect(transcriptModifications(value.state())).toEqual(after);
    });

    it.each(["改😀", ""])("keeps source marks and hard breaks between replacements of different lengths (%j)", replacement => {
        const tokens = ["前甲", "😀\n", "乙甲末"];
        const value = editor(tokens), index = createTextIndex(transcript(tokens));
        value.select(8, 2);
        const before = value.state().doc;
        const [group] = new VocabularyIndex([rule("甲", replacement)]).replacements(documentText(before), 1, 7);
        expect(applyTranscriptVocabulary(vocabularyRequest(value), group)).toBe(true);
        const after = value.state().doc;
        expect(documentText(after)).toBe(`前${replacement}😀\n乙${replacement}末`);
        expect(after.eq(value.state().schema.nodeFromJSON(transcriptContent(index, transcriptModifications(value.state()))))).toBe(true);
        expect(value.state().selection).toMatchObject({ anchor: 6 + replacement.length * 2, head: 2 });
        value.history("undo");
        expect(value.state().doc.eq(before)).toBe(true);
        value.history("redo");
        expect(value.state().doc.eq(after)).toBe(true);
    });

    it("records a disjoint reference replacement as one undo entry", () => {
        const value = editor("什么"), index = createTextIndex(transcript(["什么"]));
        const initial = transcriptProjection(value.state());
        const before = editText(index, initial, 1, 1, "X", false);
        value.apply(closeHistory(projectionTransaction(value.state(), initial, before)));
        value.select(1);
        const after = replaceText(index, before, textReplacement(index, before, [0], 0, 0, 0)!, "怎样");
        value.apply(closeHistory(projectionTransaction(value.state(), before, after)));
        expect(documentText(value.state().doc)).toBe("怎样X");
        expect(undoDepth(value.state())).toBe(2);
        expect(transcriptModifications(value.state())).toEqual(after.modifications);
        value.history("undo");
        expect(documentText(value.state().doc)).toBe("什X么");
        expect(transcriptModifications(value.state())).toEqual(before.modifications);
        value.history("redo");
        expect(documentText(value.state().doc)).toBe("怎样X");
        expect(transcriptModifications(value.state())).toEqual(after.modifications);
    });

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

    it.each(["align", "restore", "replace", "insert"])("keeps %s as one undoable explicit projection write", action => {
        const value = editor("LwhatR"), index = createTextIndex(transcript(["LwhatR"]));
        const initial = transcriptProjection(value.state());
        const before = editText(index, initial, 1, 5, "want", false);
        value.apply(closeHistory(projectionTransaction(value.state(), initial, before)));
        value.select(6, 2);
        const after = action === "align" ? alignText(index, before, 1, 5)
            : action === "restore" ? restoreTextDeletion(index, before, 1, 5)
                : action === "replace" ? editText(index, before, 1, 5, "what", false) : editText(index, before, 1, 1, "what", false);
        value.apply(closeHistory(projectionTransaction(value.state(), before, after)));
        expect(transcriptModifications(value.state())).toEqual(after.modifications);
        expect(documentText(value.state().doc)).toBe(after.text);
        expect(undoDepth(value.state())).toBe(2);
        const selection = value.state().selection;
        expect(value.history("undo")).toBe(true);
        expect(transcriptModifications(value.state())).toEqual(before.modifications);
        expect(documentText(value.state().doc)).toBe(before.text);
        expect(value.history("redo")).toBe(true);
        expect(transcriptModifications(value.state())).toEqual(after.modifications);
        expect(documentText(value.state().doc)).toBe(after.text);
        expect(value.state().selection.anchor).toBeGreaterThanOrEqual(value.state().selection.head);
        if (action !== "restore" && action !== "insert") expect(value.state().selection.eq(selection)).toBe(true);
    });

    it("undoes partial alignment without changing unselected added text or selection direction", () => {
        const value = editor("LwhatR"), index = createTextIndex(transcript(["LwhatR"]));
        const initial = transcriptProjection(value.state()), before = editText(index, initial, 1, 5, "want", false);
        value.apply(closeHistory(projectionTransaction(value.state(), initial, before)));
        value.select(3, 2);
        const aligned = alignText(index, before, 1, 2);
        value.apply(closeHistory(projectionTransaction(value.state(), before, aligned)));
        const expected = editText(index, initial, 2, 5, "ant", false).modifications;
        expect(transcriptModifications(value.state())).toEqual(expected);
        expect(documentText(value.state().doc)).toBe("LwantR");
        expect(value.state().selection).toMatchObject({ anchor: 3, head: 2 });
        expect(value.history("undo")).toBe(true);
        expect(transcriptModifications(value.state())).toEqual(before.modifications);
        expect(value.history("redo")).toBe(true);
        expect(transcriptModifications(value.state())).toEqual(expected);
        expect(value.state().selection).toMatchObject({ anchor: 3, head: 2 });
    });

    it("maps restoration at the marker even when adjacent added text is identical", () => {
        const value = editor("Outro"), index = createTextIndex(transcript(["Outro"]));
        const initial = transcriptProjection(value.state()), before = editText(index, initial, 1, 2, "u", false);
        value.apply(closeHistory(projectionTransaction(value.state(), initial, before)));
        value.select(2);
        const restored = restoreTextDeletion(index, before, 1, 2);
        value.apply(closeHistory(projectionTransaction(value.state(), before, restored, { from: 1, to: 1, text: "u" })));
        expect(documentText(value.state().doc)).toBe("Ouutro");
        expect(value.state().selection.head).toBe(3);
        expect(transcriptModifications(value.state())).toEqual(restored.modifications);
        expect(value.history("undo")).toBe(true);
        expect(transcriptModifications(value.state())).toEqual(before.modifications);
        expect(value.history("redo")).toBe(true);
        expect(transcriptModifications(value.state())).toEqual(restored.modifications);
    });

    it.each(["t", "that"])("does not preserve an inherited source mark when replacing what with %s", text => {
        const value = editor("what"), index = createTextIndex(transcript(["what"]));
        value.select(1, 5);
        value.apply(value.state().tr.insertText(text));
        expect(transcriptModifications(value.state())).toEqual(editText(index, transcriptProjection(editor("what").state()), 0, 4, text).modifications);
        expect(value.state().doc.firstChild?.firstChild?.marks[0].attrs.kind).toBe("modification");
        value.history("undo");
        expect(transcriptModifications(value.state())).toEqual([]);
        value.history("redo");
        expect(documentText(value.state().doc)).toBe(text);
    });
});