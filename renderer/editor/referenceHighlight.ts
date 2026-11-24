import { matchReferenceRange, type ReferencePane } from "../../shared/transcript/reference";
import { projectionOffset, type TextSpan } from "../../shared/transcript/text";
import { type Range } from "../../shared/util/range";
import * as settings from "../states/settings.svelte";
import { referenceTimeIndex } from "./referenceTime";

type ReferenceHighlight = (source: ReferencePane, target: ReferencePane, selection: TextSpan, time: Range | null, duration: number) => TextSpan | null;

const highlightByTime: ReferenceHighlight = (_source, target, _selection, time, duration) => {
    if (!time) return null;
    const offsets = referenceTimeIndex(target.index, duration).rangeAtTime(target.projection, time);
    return offsets && { from: projectionOffset(target.projection, offsets.from, false), to: projectionOffset(target.projection, offsets.to, false) };
};

const highlightByText: ReferenceHighlight = (source, target, selection, time) => matchReferenceRange(source, target, selection, time)?.target ?? null;

export const referenceHighlight: ReferenceHighlight = (source, target, selection, time, duration) => {
    if (settings.getEditing().referenceMatching === "text") {
        const matched = highlightByText(source, target, selection, time, duration);
        if (matched) return matched;
    }
    return highlightByTime(source, target, selection, time, duration);
};