import { type Editor } from "@tiptap/core";
import { type EditorView } from "@tiptap/pm/view";
import { referenceTimeIndex } from "./referenceTime";
import { compositionPending } from "./composition";
import { markAutomaticTranscriptScroll, subscribeTranscriptScroll } from "./scrollInput";
import { transcriptProjection, transcriptTextIndex } from "./transcript";
import { anchorTranscriptViewport, setTranscriptViewportPaired, transcriptViewportCenter } from "./viewport";

type ScrollPane = { view: EditorView; prepare: () => void; centerTime: () => number | undefined; centerOn: (time: number) => void };
function scrollPane(editor: Editor, duration: number): ScrollPane {
    const view = editor.view, scroll = view.dom.closest<HTMLElement>(".transcript-scroll")!;
    const times = referenceTimeIndex(transcriptTextIndex(view.state), duration);
    function prepare(): void {
        times.prepare(transcriptProjection(view.state).tree);
    }
    prepare();
    setTranscriptViewportPaired(view, true);
    return {
        view, prepare,
        centerTime(): number | undefined {
            const pos = transcriptViewportCenter(view, scroll);
            return pos === null ? undefined : times.timeAt(transcriptProjection(view.state).tree, pos - 1);
        },
        centerOn(time: number): void {
            const offset = times.offsetAtTime(transcriptProjection(view.state), time);
            if (offset === undefined || !scroll.clientHeight) return;
            const pos = 1 + offset;
            const rect = view.coordsAtPos(pos, 1);
            const delta = (rect.top + rect.bottom) / 2 - (scroll.getBoundingClientRect().top + scroll.clientTop + scroll.clientHeight / 2);
            const top = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, scroll.scrollTop + delta));
            if (Math.abs(top - scroll.scrollTop) < 0.5) return;
            markAutomaticTranscriptScroll(view, top);
            scroll.scrollTop = top;
            anchorTranscriptViewport(view, pos);
        }
    };
}

export function synchronizeTranscriptScroll(primary: Editor, reference: Editor, duration: number): () => void {
    const left = scrollPane(primary, duration), right = scrollPane(reference, duration);
    let source = left, frame = 0;
    const composing = (): boolean => left.view.composing || compositionPending(left.view.state);
    let wasComposing = composing();

    function schedule(pane: typeof left): void {
        source = pane;
        if (frame || composing()) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (left.view.isDestroyed || right.view.isDestroyed || composing()) return;
            const time = source.centerTime();
            if (time !== undefined) (source === left ? right : left).centerOn(time);
        });
    }
    function update(): void {
        const active = composing();
        if (!active) left.prepare();
        if (wasComposing && !active) schedule(left);
        wasComposing = active;
    }
    const stopLeft = subscribeTranscriptScroll(left.view, (user, caret, selecting) => {
        if (user || caret || selecting) schedule(left);
    });
    const stopRight = subscribeTranscriptScroll(right.view, (user, _caret, selecting) => {
        if (user || selecting) schedule(right);
    });
    primary.on("transaction", update);
    schedule(left);
    return () => {
        cancelAnimationFrame(frame);
        primary.off("transaction", update);
        stopLeft();
        stopRight();
        setTranscriptViewportPaired(left.view, false);
        setTranscriptViewportPaired(right.view, false);
    };
}