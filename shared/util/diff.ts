export type CommonRun = { a: number; b: number; length: number };

// A longest common subsequence of a and b, as maximal runs of equal elements in order.
// Myers' linear-space bisection (as in diff-match-patch, without its heuristics) keeps every split on a shortest edit path.
export function commonRuns(a: ArrayLike<number>, b: ArrayLike<number>): CommonRun[] {
    const runs: CommonRun[] = [];
    function push(aFrom: number, bFrom: number, length: number): void {
        const previous = runs.at(-1);
        if (previous && previous.a + previous.length === aFrom && previous.b + previous.length === bFrom) previous.length += length;
        else runs.push({ a: aFrom, b: bFrom, length });
    }
    function collect(aFrom: number, aTo: number, bFrom: number, bTo: number): void {
        let prefix = 0;
        while (aFrom + prefix < aTo && bFrom + prefix < bTo && a[aFrom + prefix] === b[bFrom + prefix]) prefix++;
        if (prefix) push(aFrom, bFrom, prefix);
        aFrom += prefix;
        bFrom += prefix;
        let suffix = 0;
        while (aTo - suffix > aFrom && bTo - suffix > bFrom && a[aTo - suffix - 1] === b[bTo - suffix - 1]) suffix++;
        aTo -= suffix;
        bTo -= suffix;
        if (aFrom < aTo && bFrom < bTo) {
            const split = bisect(a, b, aFrom, aTo, bFrom, bTo);
            if (split) {
                collect(aFrom, split[0], bFrom, split[1]);
                collect(split[0], aTo, split[1], bTo);
            }
        }
        if (suffix) push(aTo, bTo, suffix);
    }
    collect(0, a.length, 0, b.length);
    return runs;
}

// A point on a shortest edit path strictly inside the box, or null when the two ranges share no element.
// The ranges must differ in their first and in their last elements.
function bisect(a: ArrayLike<number>, b: ArrayLike<number>, aFrom: number, aTo: number, bFrom: number, bTo: number): [number, number] | null {
    const n = aTo - aFrom, m = bTo - bFrom;
    const maxD = Math.ceil((n + m) / 2);
    const offset = maxD, size = 2 * maxD;
    // Furthest x reached on each diagonal, from the start (forward) and from the end (reverse).
    const forward = new Int32Array(size).fill(-1), reverse = new Int32Array(size).fill(-1);
    forward[offset + 1] = 0;
    reverse[offset + 1] = 0;
    const delta = n - m;
    // With an odd delta the paths meet during a forward step, otherwise during a reverse step.
    const odd = delta % 2 !== 0;
    let forwardStart = 0, forwardEnd = 0, reverseStart = 0, reverseEnd = 0;
    for (let d = 0; d < maxD; d++) {
        for (let k = -d + forwardStart; k <= d - forwardEnd; k += 2) {
            const at = offset + k;
            let x = k === -d || (k !== d && forward[at - 1] < forward[at + 1]) ? forward[at + 1] : forward[at - 1] + 1;
            let y = x - k;
            while (x < n && y < m && a[aFrom + x] === b[bFrom + y]) {
                x++; y++;
            }
            forward[at] = x;
            if (x > n) forwardEnd += 2;
            else if (y > m) forwardStart += 2;
            else if (odd) {
                const other = offset + delta - k;
                if (other >= 0 && other < size && reverse[other] !== -1 && x >= n - reverse[other]) return [aFrom + x, bFrom + y];
            }
        }
        for (let k = -d + reverseStart; k <= d - reverseEnd; k += 2) {
            const at = offset + k;
            let x = k === -d || (k !== d && reverse[at - 1] < reverse[at + 1]) ? reverse[at + 1] : reverse[at - 1] + 1;
            let y = x - k;
            while (x < n && y < m && a[aTo - x - 1] === b[bTo - y - 1]) {
                x++; y++;
            }
            reverse[at] = x;
            if (x > n) reverseEnd += 2;
            else if (y > m) reverseStart += 2;
            else if (!odd) {
                const other = offset + delta - k;
                if (other >= 0 && other < size && forward[other] !== -1) {
                    const forwardX = forward[other];
                    if (forwardX >= n - x) return [aFrom + forwardX, bFrom + offset + forwardX - other];
                }
            }
        }
    }
    return null;
}