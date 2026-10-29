import { textPosition, textOffset, textPieces, type TextIndex, type TextProjection } from "../../shared/transcript/text";

export type ComparisonPart = { kind: "original" | "deleted" | "inserted" | "ellipsis"; text: string };
type Block = { from: number; to: number };

export function selectionComparison(index: TextIndex, projection: TextProjection, selection: Block & { sourceFrom: number; sourceTo: number }): ComparisonPart[] {
    if (!projection.modifications.length) return [];
    const changes: (Block & { parts: ComparisonPart[] })[] = [];
    for (const modification of projection.modifications) {
        if (modification.type !== "delete") continue;
        const from = Math.max(selection.sourceFrom, textOffset(index, modification.range.start));
        const to = Math.min(selection.sourceTo, textOffset(index, modification.range.end));
        if (from >= to) continue;
        changes.push({ from, to, parts: [{ kind: "deleted", text: index.characters.slice(from, to).join("") }] });
    }
    for (const piece of textPieces(index, projection, selection.from, selection.to, true)) {
        if (piece.source.kind !== "modification") continue;
        const first = Math.max(selection.from, piece.utf16From);
        const end = Math.min(selection.to, piece.utf16To);
        if (first >= end) continue;
        changes.push({ from: piece.sourceFrom, to: piece.sourceFrom, parts: [
            { kind: "inserted", text: piece.text.slice(first - piece.utf16From, end - piece.utf16From) }
        ] });
    }
    if (!changes.length) return [];
    changes.sort((left, right) => left.from - right.from);
    const parts: ComparisonPart[] = [];
    let cursor = selection.sourceFrom;
    function context(to: number): void {
        to = Math.min(to, selection.sourceTo);
        while (cursor < to) {
            const token = textPosition(index, cursor).segmentIdx;
            const end = Math.min(to, index.starts[token + 1]);
            parts.push({ kind: "original", text: index.characters.slice(cursor, end).join("") });
            cursor = end;
        }
    }
    for (const change of changes) {
        context(change.from);
        parts.push(...change.parts);
        cursor = Math.max(cursor, change.to);
    }
    context(selection.sourceTo);
    const result: ComparisonPart[] = [];
    for (let position = 0; position < parts.length;) {
        if (parts[position].kind !== "original") {
            result.push(parts[position++]);
            continue;
        }
        let end = position;
        while (end < parts.length && parts[end].kind === "original") end++;
        const before = position > 0 ? 2 : 0;
        const after = end < parts.length ? 2 : 0;
        if (end - position <= before + after) result.push(...parts.slice(position, end));
        else result.push(...parts.slice(position, position + before), { kind: "ellipsis", text: "…" }, ...parts.slice(end - after, end));
        position = end;
    }
    return result;
}