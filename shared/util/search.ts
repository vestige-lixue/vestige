// The predicate must be false on a prefix and true on the remaining suffix.
// Return the first true index, or length when the predicate is false everywhere.
export function firstTrue(length: number, predicate: (index: number) => boolean): number {
    let from = 0;
    let to = length;
    while (from < to) {
        const middle = from + Math.floor((to - from) / 2);
        if (predicate(middle)) to = middle;
        else from = middle + 1;
    }
    return from;
}