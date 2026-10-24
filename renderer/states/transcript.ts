import { firstTrue } from "../../shared/util/search";
import * as transcript from "./transcript.svelte";

export function getWordIndex(time: number): number {
    const starts = transcript.getWordStarts();
    const boundary = time + 0.001;
    // Negating <= also preserves the no-word result for an unordered (NaN) clock.
    return firstTrue(starts.length, index => !(starts[index] <= boundary)) - 1;
}

export function getWordPosition(time: number, direction: -1 | 1, fromIndex = getWordIndex(time)): number | null {
    // An explicit index keeps repeated navigation independent of playback progress.
    return transcript.getWordStarts()[fromIndex + direction] ?? null;
}