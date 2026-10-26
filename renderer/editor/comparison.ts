import { textPosition, textOffset, textPieces, sourceTextPieces, codepointToUtf16, type TextIndex, type TextProjection } from "../../shared/transcript/text";

export type ComparisonPart = { kind: "original" | "deleted" | "inserted" | "ellipsis"; text: string };
type Block = { from: number; to: number };

export function selectionComparison(index: TextIndex, projection: TextProjection, selection: Block & { sourceFrom: number; sourceTo: number }): ComparisonPart[] {
    if (!projection.modifications.length) return [];
    const touched = new Set<number>();
    const insertions = textPieces(index, projection, selection.from, selection.to, true)
        .filter(piece => piece.source.kind === "modification" && piece.utf16From < piece.utf16To && piece.utf16From < selection.to && piece.utf16To > selection.from)
        .map(piece => ({ from: piece.sourceFrom, to: piece.sourceFrom, text: piece.text.slice(Math.max(0, selection.from - piece.utf16From), selection.to - piece.utf16From), used: false }));
    const insertedByPosition = new Map(insertions.map(insertion => [insertion.from, insertion]));
    for (const modification of projection.modifications) {
        if (modification.type !== "delete") continue;
        const from = Math.max(selection.sourceFrom, textOffset(index, modification.range.start));
        const to = Math.min(selection.sourceTo, textOffset(index, modification.range.end));
        if (from >= to) continue;
        const end = textPosition(index, to - 1).segmentIdx;
        for (let token = textPosition(index, from).segmentIdx; token <= end; token++) {
            if (index.starts[token] < index.starts[token + 1]) touched.add(token);
        }
    }
    for (const insertion of insertions) {
        const token = textPosition(index, insertion.from).segmentIdx;
        if (insertion.from > index.starts[token] && insertion.from < index.starts[token + 1]) touched.add(token);
    }
    const blocks: Block[] = [];
    for (const token of [...touched].sort((left, right) => left - right)) {
        const from = Math.max(selection.sourceFrom, index.starts[token]);
        const to = Math.min(selection.sourceTo, index.starts[token + 1]);
        if (from >= to) continue;
        const previous = blocks.at(-1);
        if (previous?.to === from) previous.to = to;
        else blocks.push({ from, to });
    }
    const changes: (Block & { parts: ComparisonPart[] })[] = blocks.map(block => {
        let current = "";
        for (const piece of sourceTextPieces(index, projection, block.from, block.to)) {
            if (piece.source.kind === "segment") {
                const from = Math.max(block.from, piece.sourceFrom);
                const to = Math.min(block.to, piece.sourceTo);
                if (from >= to) continue;
                const first = Math.max(codepointToUtf16(piece.text, from - piece.sourceFrom), selection.from - piece.utf16From);
                const end = Math.min(codepointToUtf16(piece.text, to - piece.sourceFrom), selection.to - piece.utf16From);
                if (first < end) current += piece.text.slice(first, end);
            }
            else if (piece.sourceFrom === piece.sourceTo) {
                const insertion = insertedByPosition.get(piece.sourceFrom);
                if (insertion && !insertion.used) {
                    current += insertion.text;
                    insertion.used = true;
                }
            }
        }
        return { ...block, parts: [
            { kind: "deleted", text: index.characters.slice(block.from, block.to).join("") },
            ...current ? [{ kind: "inserted" as const, text: current }] : []
        ] };
    });
    for (const insertion of insertions) {
        if (!insertion.used) changes.push({ from: insertion.from, to: insertion.to, parts: [{ kind: "inserted", text: insertion.text }] });
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