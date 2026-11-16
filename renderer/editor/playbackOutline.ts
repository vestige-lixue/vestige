import { type Editor } from "@tiptap/core";
import { compositionPending } from "./composition";
import { subscribeTranscriptLayout, transcriptLayoutVersion } from "./layout";
import { walkTranscriptDOM } from "./textDOM";
import { transcriptPlaybackRanges } from "./transcript";

export type PlaybackOutline = { paths: string[]; strokeWidth: number };
type Rectangle = { left: number; right: number; top: number; bottom: number };

/** Ranges use ProseMirror positions; merge in displayed order, ignoring zero-width widgets. */
function continuousRanges(ranges: readonly number[]): { from: number; to: number }[] {
    const sorted: { from: number; to: number }[] = [];
    for (let i = 0; i < ranges.length; i += 2) sorted.push({ from: ranges[i] - 1, to: ranges[i + 1] - 1 });
    sorted.sort((left, right) => left.from - right.from);
    const result: typeof sorted = [];
    for (const range of sorted) {
        const previous = result.at(-1);
        if (previous && previous.to >= range.from) previous.to = Math.max(previous.to, range.to);
        else result.push({ ...range });
    }
    return result;
}

export function attachTranscriptPlaybackOutline(editor: Editor, element: HTMLElement, paint: (outline: PlaybackOutline) => void): () => void {
    const view = editor.view;
    let frame = 0;
    let cached: { version: number; ranges: readonly number[] } | undefined;
    function refresh(): void {
        frame = 0;
        // Neither geometry reads nor layer writes may touch an in-progress composition.
        if (view.isDestroyed || view.composing || compositionPending(view.state)) return;
        const version = transcriptLayoutVersion(view), ranges = transcriptPlaybackRanges(view.state);
        if (cached?.version === version && cached.ranges === ranges) return;
        cached = { version, ranges };
        if (!ranges.length) return paint({ paths: [], strokeWidth: 0 });
        const origin = element.getBoundingClientRect();
        const fontSize = parseFloat(getComputedStyle(view.dom).fontSize);
        const strokeWidth = fontSize * .125;
        // SVG strokes are centered; CSS outlines start outside their offset from the content box.
        const outset = fontSize * .0625 + strokeWidth / 2;
        const paths: string[] = [];
        const selection = document.createRange();
        for (const segment of continuousRanges(ranges)) {
            const rectangles: Rectangle[] = [];
            walkTranscriptDOM(view, segment, (node, from, to) => {
                if (node instanceof Text) {
                    selection.setStart(node, Math.max(segment.from - from, 0));
                    selection.setEnd(node, Math.min(segment.to, to) - from);
                }
                else selection.selectNode(node);
                for (const rect of selection.getClientRects()) {
                    if (rect.height < .5) continue;
                    const previous = rectangles.at(-1);
                    if (previous && Math.abs(previous.top - rect.top) < 1 && Math.abs(previous.bottom - rect.bottom) < 1) {
                        previous.left = Math.min(previous.left, rect.left);
                        previous.right = Math.max(previous.right, rect.right);
                    }
                    else rectangles.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
                }
            });
            for (const [index, rect] of rectangles.entries()) {
                const left = rect.left - origin.left - outset, right = rect.right - origin.left + outset;
                const top = rect.top - origin.top - outset, bottom = rect.bottom - origin.top + outset;
                paths.push(`M ${left} ${top} H ${right} M ${left} ${bottom} H ${right}`
                    + (index === 0 ? ` M ${left} ${top} V ${bottom}` : "")
                    + (index === rectangles.length - 1 ? ` M ${right} ${top} V ${bottom}` : ""));
            }
        }
        // Do not leave a live Range tracking subsequent editor mutations.
        selection.setStart(view.dom, 0);
        selection.collapse(true);
        paint({ paths, strokeWidth });
    }
    function schedule(): void {
        if (!frame) frame = requestAnimationFrame(refresh);
    }
    const unsubscribe = subscribeTranscriptLayout(view, schedule);
    editor.on("transaction", schedule);
    schedule();
    return () => {
        cancelAnimationFrame(frame);
        unsubscribe();
        editor.off("transaction", schedule);
    };
}