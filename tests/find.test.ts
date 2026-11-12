import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { Mapping, StepMap } from "@tiptap/pm/transform";
import { findOccurrences, preserveReplacementCase, bufferTextWindow, mapTextWindow, intersectTextWindow, windowOccurrenceIndices } from "../shared/transcript/find";

const wholeWord = { caseSensitive: false, wholeWord: true };

describe("transcript painting window", () => {
    it.each([
        [[5, 10, 0], 90, { from: 4, to: 10 }],
        [[18, 10, 0], 90, { from: 10, to: 17 }],
        [[16, 0, 5], 105, { from: 10, to: 25 }],
        [[11, 0, 3], 103, { from: 10, to: 23 }],
        [[21, 0, 3], 103, { from: 10, to: 23 }],
        [[1, 100, 0], 0, { from: 0, to: 0 }]
    ])("maps displayed offsets through PM step %j, clamping to length %i", (step, length, expected) => {
        const mapping = new Mapping([new StepMap(step)]);
        expect(mapTextWindow({ from: 10, to: 20 }, length, (pos, assoc) => mapping.map(pos, assoc))).toEqual(expected);
    });

    it("composes root and appended transactions when mapping a window", () => {
        const mapping = new Mapping([new StepMap([6, 0, 4]), new StepMap([22, 5, 0])]);
        expect(mapTextWindow({ from: 10, to: 20 }, 99, (pos, assoc) => mapping.map(pos, assoc))).toEqual({ from: 14, to: 21 });
    });

    it("buffers by the visible character span and clamps both document ends", () => {
        expect(bufferTextWindow({ from: 30, to: 50 }, 100)).toEqual({ from: 10, to: 70 });
        expect(bufferTextWindow({ from: 0, to: 20 }, 100)).toEqual({ from: 0, to: 40 });
        expect(bufferTextWindow({ from: 80, to: 100 }, 100)).toEqual({ from: 60, to: 100 });
        expect(bufferTextWindow({ from: 0, to: 0 }, 0)).toEqual({ from: 0, to: 0 });
        expect(bufferTextWindow({ from: 5, to: 5 }, 10)).toEqual({ from: 4, to: 6 });
    });

    it("clips selections and crossing hits to a half-open window, excluding touching boundaries", () => {
        const window = { from: 10, to: 20 };
        expect(intersectTextWindow({ from: 0, to: 100 }, window)).toEqual(window);
        expect(intersectTextWindow({ from: 8, to: 12 }, window)).toEqual({ from: 10, to: 12 });
        expect(intersectTextWindow({ from: 18, to: 25 }, window)).toEqual({ from: 18, to: 20 });
        expect(intersectTextWindow({ from: 12, to: 15 }, window)).toEqual({ from: 12, to: 15 });
        expect(intersectTextWindow({ from: 0, to: 10 }, window)).toBeNull();
        expect(intersectTextWindow({ from: 20, to: 25 }, window)).toBeNull();
        expect(intersectTextWindow({ from: 15, to: 15 }, window)).toBeNull();
        expect(intersectTextWindow(window, { from: 15, to: 15 })).toBeNull();
    });

    it("selects boundary and crossing matches by index and includes a distant current match once", () => {
        const matches = [{ from: 0, to: 10 }, { from: 10, to: 14 }, { from: 16, to: 22 }, { from: 25, to: 30 }];
        expect(windowOccurrenceIndices(matches, { from: 10, to: 20 })).toEqual([1, 2]);
        expect(windowOccurrenceIndices(matches, { from: 10, to: 20 }, 0)).toEqual([0, 1, 2]);
        expect(windowOccurrenceIndices(matches, { from: 10, to: 20 }, 3)).toEqual([1, 2, 3]);
        expect(windowOccurrenceIndices(matches, { from: 10, to: 20 }, 1)).toEqual([1, 2]);
        expect(windowOccurrenceIndices(matches, { from: 10, to: 10 }, 1)).toEqual([1]);
        expect(windowOccurrenceIndices(matches, { from: 12, to: 12 })).toEqual([]);
        expect(windowOccurrenceIndices([], { from: 0, to: 100 }, 0)).toEqual([]);
        expect(windowOccurrenceIndices(matches, { from: 40, to: 50 }, 99)).toEqual([]);
    });

    it("agrees with a full scan for arbitrary windows and current indices", () => {
        fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 10 }), { maxLength: 100 }), fc.nat(1200), fc.nat(1200), fc.integer({ min: -1, max: 101 }), (lengths, a, b, current) => {
            let offset = 0;
            const matches = lengths.map(length => {
                const match = { from: offset, to: offset + length };
                offset += length + 1;
                return match;
            });
            const window = { from: Math.min(a, b), to: Math.max(a, b) };
            expect(windowOccurrenceIndices(matches, window, current)).toEqual(matches.flatMap((match, i) =>
                intersectTextWindow(match, window) || i === current ? [i] : []));
        }));
    });
});

describe("transcript find", () => {
    it.each([
        ["CAT", "dOg", "DOG"], ["cat", "dOg", "dog"], ["Cat", "dOg", "DOg"], ["iPhone", "dOg", "dOg"],
        ["中文123，", "dOg", "dOg"], ["猫Cat", "dog", "Dog"], ["猫cAT", "dOg", "dOg"], ["Cat", "", ""],
        ["CAT", "ß", "SS"], ["ß", "DOG", "dog"], ["猫ẞ", "ßeta", "SSETA"], ["Cat", "ßeta", "SSeta"],
        ["a-B", "C-d", "C-d"], ["CAT_dog", "first_SECOND", "First_SECOND"], ["Cat", "😀dog", "😀dog"]
    ])("preserves the case of %j when writing %j", (match, replacement, expected) => {
        expect(preserveReplacementCase(match, replacement)).toBe(expected);
    });

    it("returns leftmost nonoverlapping UTF-16 ranges and ignores an empty query", () => {
        expect(findOccurrences("aaa", "aa")).toEqual([{ from: 0, to: 2 }]);
        expect(findOccurrences("abc", "")).toEqual([]);
        expect(findOccurrences("", "a")).toEqual([]);
        expect(findOccurrences("😀猫😀猫", "😀猫")).toEqual([{ from: 0, to: 3 }, { from: 3, to: 6 }]);
        expect(findOccurrences("😀", "\uD83D")).toEqual([]);
        expect(findOccurrences("😀", "\uDE00")).toEqual([]);
    });

    it("folds individual code points without moving offsets or expanding characters", () => {
        expect(findOccurrences("Cat cAT", "cat")).toEqual([{ from: 0, to: 3 }, { from: 4, to: 7 }]);
        expect(findOccurrences("Cat cAT", "cat", { caseSensitive: true, wholeWord: false })).toEqual([]);
        expect(findOccurrences("İ😀Cat", "cat")).toEqual([{ from: 3, to: 6 }]);
        expect(findOccurrences("İ i I", "i")).toEqual([{ from: 2, to: 3 }, { from: 4, to: 5 }]);
        expect(findOccurrences("İ i", "İ")).toEqual([{ from: 0, to: 1 }]);
        expect(findOccurrences("ß ς", "SS")).toEqual([]);
        expect(findOccurrences("ß ς", "σ")).toEqual([]);
        expect(findOccurrences("𐐀😀𐐨", "𐐨")).toEqual([{ from: 0, to: 2 }, { from: 4, to: 6 }]);
    });

    it.each(["a cat.", "用 cat，", "（cat）", "cat", "cat dog", "dog cat"])("finds whole words beside Unicode separators in %j", text => {
        const from = text.indexOf("cat");
        expect(findOccurrences(text, "cat", wholeWord)).toEqual([{ from, to: from + 3 }]);
    });

    it.each(["concatenate", "cats", "cat_x", "cat1", "cat\u0301", "猫cat", "catカ"])("rejects a word joined to letters, numbers, marks or connector punctuation in %j", text => {
        expect(findOccurrences(text, "cat", wholeWord)).toEqual([]);
    });

    it("requires boundaries for CJK and allows a separator at either end of the match itself", () => {
        expect(findOccurrences("这是中文吗", "中文", wholeWord)).toEqual([]);
        expect(findOccurrences("这是“中文”吗", "中文", wholeWord)).toEqual([{ from: 3, to: 5 }]);
        expect(findOccurrences("x.cat", ".cat", wholeWord)).toEqual([{ from: 1, to: 5 }]);
        expect(findOccurrences("cat.x", "cat.", wholeWord)).toEqual([{ from: 0, to: 4 }]);
        expect(findOccurrences("x.cats", ".cat", wholeWord)).toEqual([]);
        expect(findOccurrences("😀cat\u200B", "cat", wholeWord)).toEqual([{ from: 2, to: 5 }]);
    });

    it("preserves every whitespace character and the query's leading and trailing spaces", () => {
        expect(findOccurrences(" \t　 \n　", "　")).toEqual([{ from: 2, to: 3 }, { from: 5, to: 6 }]);
        expect(findOccurrences("a a  a ", " a ")).toEqual([{ from: 1, to: 4 }, { from: 4, to: 7 }]);
        expect(findOccurrences("a\tb a b", "a\tb")).toEqual([{ from: 0, to: 3 }]);
    });

    it("agrees with a code-point reference search and returns sorted, disjoint literal matches", () => {
        const character = fc.constantFrom("a", "A", "b", "İ", "i", "ß", "ς", "σ", "𐐀", "𐐨", "猫", "カ", "😀", "_", "1", "\u0301", ".", " ", "　", "\t", "\u200B");
        const folded = (value: string): string => Array.from(value, c => Array.from(c.toLowerCase()).length === 1 ? c.toLowerCase() : c).join("");
        const word = (value: string): boolean => /[\p{L}\p{N}\p{M}\p{Pc}]/u.test(value);
        fc.assert(fc.property(fc.array(character, { maxLength: 60 }), fc.array(character, { minLength: 1, maxLength: 6 }), fc.boolean(), fc.boolean(), (chars, pattern, caseSensitive, wholeWord) => {
            const text = chars.join(""), query = pattern.join("");
            const expected: { from: number; to: number }[] = [];
            for (let i = 0, offset = 0; i < chars.length;) {
                const end = i + pattern.length;
                const candidate = chars.slice(i, end).join("");
                const equal = caseSensitive ? candidate === query : folded(candidate) === folded(query);
                const boundary = (i === 0 || !word(chars[i - 1]) || !word(chars[i]))
                    && (end === chars.length || !word(chars[end] ?? "") || !word(chars[end - 1] ?? ""));
                if (equal && (!wholeWord || boundary)) {
                    expected.push({ from: offset, to: offset + candidate.length });
                    i = end;
                    offset += candidate.length;
                }
                else offset += chars[i++].length;
            }
            expect(findOccurrences(text, query, { caseSensitive, wholeWord })).toEqual(expected);
        }), { numRuns: 500 });
    });
});