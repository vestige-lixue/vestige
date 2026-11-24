import { matchReferencePosition, matchReferenceRange, referenceCandidate, type ReferencePane } from "../../shared/transcript/reference";
import { displayedPieces } from "../../shared/transcript/pieces";
import { projectionSlice, replacementBlocks, replacementEdits, tokenReplacementRanges, type TextEdit, type TextProjection, type TextSpan } from "../../shared/transcript/text";
import { type Settings } from "../../shared/settings/Settings";
import { type Range } from "../../shared/util/range";
import { editComparison, type ComparisonPart } from "./comparison";

export type ReferenceReplacementRequest = { range: Range } & (
    { kind: "selection"; selection: TextSpan; tokens: readonly number[] } | { kind: "gap"; position: number }
);
export type ReferenceReplacement = {
    edits: TextEdit[];
    display: { kind: "timing"; text: string; range: Range; target: Range }
        | { kind: "comparison"; parts: ComparisonPart[] };
};
type ReferenceReplacementMatch = (source: ReferencePane, target: ReferencePane, request: ReferenceReplacementRequest,
    settings: Settings["editing"]) => ReferenceReplacement | false | null;

const replaceByTime: ReferenceReplacementMatch = (source, target, request, settings) => {
    const candidate = referenceCandidate(target.index, request.range, settings.referenceOverlap);
    if (!candidate) return null;
    let edits: TextEdit[];
    if (request.kind === "gap") edits = [{ from: request.position, to: request.position, text: candidate.text }];
    else {
        const original = tokenReplacementRanges(source.index, source.projection, request.tokens);
        const blocks = replacementBlocks(source.projection, original, request.selection);
        if (!blocks || blocks.parts.map(part => part.text).join("") === candidate.text) return null;
        edits = replacementEdits(blocks, candidate.text);
    }
    return { edits, display: { kind: "timing", text: candidate.text, range: candidate.range, target: request.range } };
};

// False means alignment succeeded and produced no edits. Only null falls back.
const replaceByText: ReferenceReplacementMatch = (source, target, request) => {
    if (request.kind === "gap") {
        const { position } = request;
        const matched = matchReferencePosition(source, target, position, request.range);
        if (!matched) return matched;
        const text = projectionSlice(target.projection, matched);
        return {
            edits: [{ from: position, to: position, text }],
            display: { kind: "comparison", parts: [{ kind: "inserted", text }] }
        };
    }
    const { selection } = request;
    const match = matchReferenceRange(source, target, selection, request.range);
    if (!match) return null;
    const projection = source.projection;
    const edits = match.differences.flatMap(({ source: { from, to }, target: counterpart }) => {
        const text = projectionSlice(target.projection, counterpart);
        if (from === to) return [{ from, to, text }];
        const original: TextSpan[] = [];
        for (const piece of displayedPieces(projection.tree, from, to)) {
            if (piece.kind !== "segment") continue;
            const start = Math.max(from, piece.from), end = Math.min(to, piece.to);
            if (start < end) original.push({ from: start, to: end });
        }
        const blocks = replacementBlocks(projection, original, { from: Math.max(from, selection.from), to: Math.min(to, selection.to) }, selection.from);
        return blocks ? replacementEdits(blocks, text) : [{ from: to, to, text }];
    }).filter(edit => edit.text !== projectionSlice(projection, edit));
    if (!edits.length) return false;
    return { edits, display: { kind: "comparison", parts: editComparison(projection, match.source, edits) } };
};

function changesText(projection: TextProjection, edits: readonly TextEdit[]): boolean {
    if (!edits.length) return false;
    const from = edits[0].from;
    let cursor = from;
    const parts: string[] = [];
    for (const edit of edits) {
        parts.push(projectionSlice(projection, { from: cursor, to: edit.from }), edit.text);
        cursor = edit.to;
    }
    return parts.join("") !== projectionSlice(projection, { from, to: cursor });
}

export function referenceReplacement(source: ReferencePane, target: ReferencePane, request: ReferenceReplacementRequest,
    settings: Settings["editing"]): ReferenceReplacement | null {
    const text = settings.referenceMatching === "text" ? replaceByText(source, target, request, settings) : null;
    const candidate = text ?? replaceByTime(source, target, request, settings);
    return candidate && changesText(source.projection, candidate.edits) ? candidate : null;
}