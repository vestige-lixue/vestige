import { lineWidth, type TextLayout, type TextRange } from "./breaks";

export function addLine(layout: TextLayout, lines: readonly TextRange[], index: number, maxWidth: number | null): TextRange[] {
    const result = [...lines], previous = result.at(-1);
    if (!previous || lineWidth(layout, previous.from, previous.to) > 0 && (layout.lineBreaks[index - 1]
        || maxWidth !== null && lineWidth(layout, index, index + 1) > 0 && lineWidth(layout, previous.from, index + 1) > maxWidth)) {
        result.push({ from: index, to: index + 1 });
    }
    else result[result.length - 1] = { from: previous.from, to: index + 1 };
    return result;
}

export function greedyLines(layout: TextLayout, from: number, to: number, maxWidth: number | null): TextRange[] {
    let lines: TextRange[] = [];
    for (let i = from; i < to; i++) lines = addLine(layout, lines, i, maxWidth);
    return lines.filter(line => lineWidth(layout, line.from, line.to) > 0);
}

function balanceLines(layout: TextLayout, from: number, to: number, maxWidth: number | null): TextRange[] {
    const greedy = greedyLines(layout, from, to, maxWidth), count = greedy.length;
    if (maxWidth === null || count < 2 || greedy.some(line => lineWidth(layout, line.from, line.to) > maxWidth)) return greedy;
    const farthest: number[] = [], needed: number[] = [];
    let end = from;
    for (let i = from; i < to; i++) {
        end = Math.max(end, i + 1);
        while (end < to && lineWidth(layout, i, end + 1) <= maxWidth) end++;
        farthest[i - from] = end;
    }
    needed[to - from] = 0;
    for (let i = to - 1; i >= from; i--) needed[i - from] = lineWidth(layout, i, to) > 0 ? 1 + needed[farthest[i - from] - from] : 0;
    const total = lineWidth(layout, from, to), result: TextRange[] = [];
    let start = from;
    for (let k = 1; k < count; k++) {
        const target = k * total / count;
        let best = -1, rank = Infinity, distance = Infinity;
        for (let cut = start + 1; cut < to; cut++) {
            const width = lineWidth(layout, start, cut);
            if (width <= 0 || width > maxWidth || needed[cut - from] > count - k
                || layout.textCounts[to] - layout.textCounts[cut] < count - k) continue;
            const offset = Math.abs(lineWidth(layout, from, cut) - target), boundary = layout.boundaries[cut - 1];
            const priority = (boundary === "sentence" || boundary === "clause") && offset <= maxWidth / 4 ? 0 : 1;
            if (priority < rank || priority === rank && offset < distance) {
                best = cut; rank = priority; distance = offset;
            }
        }
        if (best < 0) return greedy;
        result.push({ from: start, to: best }); start = best;
    }
    result.push({ from: start, to });
    return result.length > count || result.some(line => lineWidth(layout, line.from, line.to) > maxWidth) ? greedy : result;
}

export function subtitleLines(layout: TextLayout, from: number, to: number, maxWidth: number | null): string[] {
    const lines: TextRange[] = [];
    let start = from;
    for (let i = from; i < to; i++) {
        if (layout.lineBreaks[i] || i + 1 === to) {
            lines.push(...balanceLines(layout, start, i + 1, maxWidth)); start = i + 1;
        }
    }
    return lines.map(line => layout.text.slice(layout.offsets[line.from], layout.offsets[line.to]).trim()).filter(Boolean);
}