import { type Editor, type EditorEvents } from "@tiptap/core";
import { projectionOffset } from "../../shared/transcript/text";
import { subscribe } from "../states/settings";
import { compositionPending } from "./composition";
import { transcriptSelectionTime } from "./informationModel";
import { referenceHighlight } from "./referenceHighlight";
import { observeTranscriptSelection } from "./selection";
import { transcriptProjection, transcriptTextIndex } from "./transcript";

export function synchronizeTranscriptSelection(primary: Editor, reference: Editor, duration: number): () => void {
    const document = primary.view.dom.ownerDocument, owner = document.defaultView!;
    let frame = 0;
    const composing = (): boolean => primary.view.composing || compositionPending(primary.state);
    let wasComposing = composing();
    function schedule(): void {
        if (!frame && !composing()) frame = owner.requestAnimationFrame(update);
    }
    function pane(editor: Editor): {
        view: Editor["view"]; index: ReturnType<typeof transcriptTextIndex>;
        selection: ReturnType<typeof observeTranscriptSelection>;
    } {
        const view = editor.view, index = transcriptTextIndex(view.state);
        return { view, index, selection: observeTranscriptSelection(view, schedule) };
    }
    const left = pane(primary), right = pane(reference);
    function update(): void {
        frame = 0;
        if (left.view.isDestroyed || right.view.isDestroyed || composing()) return;
        const source = document.hasFocus() && (left.view.hasFocus() ? left : right.view.hasFocus() ? right : null);
        const selected = source && source.selection.selected();
        if (!source || !selected) {
            left.selection.compare(null);
            right.selection.compare(null);
            return;
        }
        const target = source === left ? right : left;
        const from = selected.from - 1, to = selected.to - 1;
        const projection = transcriptProjection(source.view.state), targetProjection = transcriptProjection(target.view.state);
        const range = transcriptSelectionTime(source.index, projection, duration, from, to);
        const offsets = referenceHighlight({ index: source.index, projection }, { index: target.index, projection: targetProjection }, {
            from: projectionOffset(projection, from, false), to: projectionOffset(projection, to, false)
        }, range, duration);
        source.selection.compare(null);
        target.selection.compare(offsets && offsets.from < offsets.to ? {
            from: projectionOffset(targetProjection, offsets.from, true) + 1, to: projectionOffset(targetProjection, offsets.to, true) + 1
        } : null);
    }
    function transaction({ transaction, appendedTransactions }: EditorEvents["transaction"]): void {
        const active = composing();
        if (!active && (wasComposing || transaction.docChanged || appendedTransactions.some(tr => tr.docChanged))) schedule();
        wasComposing = active;
    }
    const events = new AbortController();
    document.addEventListener("focusin", schedule, { signal: events.signal });
    document.addEventListener("focusout", schedule, { signal: events.signal });
    owner.addEventListener("focus", schedule, { signal: events.signal });
    owner.addEventListener("blur", schedule, { signal: events.signal });
    primary.on("transaction", transaction);
    reference.on("transaction", transaction);
    const stopSettings = subscribe(schedule);
    return () => {
        stopSettings();
        events.abort();
        primary.off("transaction", transaction);
        reference.off("transaction", transaction);
        left.selection.destroy();
        right.selection.destroy();
        owner.cancelAnimationFrame(frame);
    };
}