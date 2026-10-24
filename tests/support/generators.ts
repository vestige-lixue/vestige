import * as fc from "fast-check";
import { type TextProjection } from "../../shared/transcript/text";
import { modification, transcript } from "./fixtures";

export const textArbitrary = fc.array(fc.constantFrom("a", "b", " ", "\n", "中", "𝄞", "e\u0301", "👩‍🔬"), { maxLength: 8 })
    .map(parts => parts.join(""));
export const transcriptArbitrary = fc.array(textArbitrary, { maxLength: 6 }).map(transcript);

export const patchesArbitrary = transcriptArbitrary.chain(spans => {
    const length = [...spans.map(span => span.token.text).join("")].length;
    return fc.integer({ min: 0, max: 5 }).chain(count => fc.tuple(
        fc.array(fc.integer({ min: 0, max: length }), { minLength: count * 2, maxLength: count * 2 }),
        fc.array(textArbitrary, { minLength: count, maxLength: count })
    ).map(([boundaries, texts]) => {
        boundaries.sort((left, right) => left - right);
        return {
            spans,
            modifications: texts.flatMap((text, index) => modification(spans, boundaries[index * 2], boundaries[index * 2 + 1], text))
        };
    }));
});

const editArbitrary = fc.record({
    first: fc.nat(),
    second: fc.nat(),
    text: textArbitrary,
    focus: fc.constantFrom("any", "any", "boundary", "boundary", "inserted", "deletion")
});
export type EditSample = typeof editArbitrary extends fc.Arbitrary<infer Sample> ? Sample : never;
export const editingArbitrary = fc.record({
    spans: transcriptArbitrary,
    edits: fc.array(editArbitrary, { minLength: 1, maxLength: 24 })
});

// Boundary-biased choices use the candidate positions only; expected text is a plain array splice.
export function editRange(projection: TextProjection, edit: EditSample): { from: number; to: number } {
    let left = edit.first % (projection.length + 1);
    let right = edit.second % (projection.length + 1);
    if (edit.focus === "boundary") {
        const boundaries = [0, projection.length, ...projection.pieces.flatMap(piece => [piece.from, piece.to])];
        left = boundaries[edit.first % boundaries.length];
        right = boundaries[edit.second % boundaries.length];
    }
    if (edit.focus === "inserted") {
        const added = projection.pieces.filter(piece => piece.source.kind === "modification" && piece.from < piece.to);
        const piece = added[edit.first % added.length];
        if (piece) {
            left = piece.from + edit.first % (piece.to - piece.from + 1);
            right = piece.from + edit.second % (piece.to - piece.from + 1);
        }
    }
    if (edit.focus === "deletion") {
        const deleted = projection.pieces.filter(piece => piece.from === piece.to);
        const piece = deleted[edit.first % deleted.length];
        if (piece) left = right = piece.from;
    }
    return { from: Math.min(left, right), to: Math.max(left, right) };
}
export const normalizationArbitrary = patchesArbitrary.chain(({ spans, modifications }) => {
    const length = [...spans.map(span => span.token.text).join("")].length;
    return fc.array(fc.record({
        position: fc.integer({ min: 0, max: length }),
        text: textArbitrary
    }), { maxLength: 6 }).map(insertions => ({
        spans,
        modifications: [...modifications, ...insertions.flatMap(item => modification(spans, item.position, item.position, item.text))]
    }));
});