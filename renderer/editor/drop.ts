import { type Slice } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { type EditorView } from "@tiptap/pm/view";

export type DropPointer = { left: number; top: number };

export function transcriptDropPosition(view: EditorView, point: DropPointer): number | null {
    const root = view.dom.getBoundingClientRect();
    if (point.left < root.left || point.left > root.right || point.top < root.top || point.top > root.bottom) return null;
    const paragraph = view.dom.firstElementChild?.getBoundingClientRect();
    if (!paragraph) return null;
    const end = view.state.doc.content.size - 1;
    if (point.top < paragraph.top) return 1;
    if (point.top > paragraph.bottom) return end;
    // The transcript has one paragraph. Side padding belongs to the same visual line,
    // rather than the block boundary returned by ProseMirror's ordinary hit test.
    const inset = Math.min(1, paragraph.width / 2);
    const position = view.posAtCoords({
        left: Math.max(paragraph.left + inset, Math.min(paragraph.right - inset, point.left)), top: point.top
    });
    return position ? Math.max(1, Math.min(end, position.pos)) : null;
}

export function handleTranscriptDrop(view: EditorView, event: DragEvent, slice: Slice, moved: boolean): boolean {
    const target = transcriptDropPosition(view, { left: event.clientX, top: event.clientY });
    if (!view.editable || target === null || !slice.size) return true;
    const { from, to } = view.state.selection;
    // Moving onto either selection edge must also preserve the original source history.
    if (moved && target >= from && target <= to) return true;
    const transaction = view.state.tr;
    if (moved) transaction.deleteSelection();
    const position = transaction.mapping.map(target);
    const before = transaction.doc;
    // The transcript's clipboard parser has already flattened the slice to inline content.
    transaction.replaceRange(position, position, slice);
    if (transaction.doc.eq(before)) return true;
    let end = position;
    transaction.mapping.maps.at(-1)!.forEach((_from, _to, _newFrom, newTo) => end = newTo);
    transaction.setSelection(TextSelection.create(transaction.doc, position, end));
    view.focus();
    view.dispatch(transaction.setMeta("uiEvent", "drop"));
    return true;
}