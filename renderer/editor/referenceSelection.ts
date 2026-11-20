import { type Editor, type EditorEvents } from "@tiptap/core";
import { compositionPending } from "./composition";
import { transcriptSelectionTime } from "./informationModel";
import { referenceTimeIndex } from "./referenceTime";
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
        time: ReturnType<typeof referenceTimeIndex>; selection: ReturnType<typeof observeTranscriptSelection>;
    } {
        const view = editor.view, index = transcriptTextIndex(view.state);
        return { view, index, time: referenceTimeIndex(index, duration), selection: observeTranscriptSelection(view, schedule) };
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
        const range = transcriptSelectionTime(source.index, transcriptProjection(source.view.state), duration, selected.from - 1, selected.to - 1);
        const offsets = range && target.time.rangeAtTime(transcriptProjection(target.view.state), range);
        source.selection.compare(null);
        target.selection.compare(offsets && { from: offsets.from + 1, to: offsets.to + 1 });
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
    schedule();
    return () => {
        events.abort();
        primary.off("transaction", transaction);
        reference.off("transaction", transaction);
        left.selection.destroy();
        right.selection.destroy();
        owner.cancelAnimationFrame(frame);
    };
}