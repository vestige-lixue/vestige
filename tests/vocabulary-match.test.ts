import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { VocabularyIndex } from "../shared/vocabulary/match";
import { vocabularyRuleIssue } from "../shared/vocabulary/Vocabulary";
import { rule } from "./support/vocabulary";

describe("vocabulary matching", () => {
    it("includes both maximum-length caret boundaries and a hit crossing the caret", () => {
        const left = rule("甲乙"), right = rule("丙丁"), crossing = rule("乙丙"), far = rule("戊");
        const index = new VocabularyIndex([far, crossing, right, left]);
        expect(index.find("戊甲乙丙丁戊", 3)).toEqual([
            { rule: left, from: 1, to: 3 }, { rule: crossing, from: 2, to: 4 }, { rule: right, from: 3, to: 5 }
        ]);
    });

    it("only returns occurrences fully contained in the selection", () => {
        const cat = rule("cat"), index = new VocabularyIndex([cat]);
        expect(index.find("catcatcat", 1, 8)).toEqual([{ rule: cat, from: 3, to: 6 }]);
        expect(index.find("catcatcat", 3, 6)).toEqual([{ rule: cat, from: 3, to: 6 }]);
    });

    it("matches substrings inside words and numbers", () => {
        const cat = rule("cat"), ten = rule("10"), a = rule("a", "b");
        const index = new VocabularyIndex([cat, ten]);
        const text = "concatenate";
        expect(index.find(text, 5)).toEqual([{ rule: cat, from: 3, to: 6 }]);
        expect(index.find(text, 0, text.length)).toEqual([{ rule: cat, from: 3, to: 6 }]);
        expect(index.find("100", 1)).toEqual([{ rule: ten, from: 0, to: 2 }]);
        expect(new VocabularyIndex([a]).replacements("banana", 0, 6)).toEqual([{ rule: a, ranges: [
            { from: 1, to: 2 }, { from: 3, to: 4 }, { from: 5, to: 6 }
        ] }]);
    });

    it("matches spaces on both sides when they are part of the rule", () => {
        const padded = rule(" a ", " b "), index = new VocabularyIndex([padded]);
        const text = "x a banana y";
        expect(index.find(text, 0, text.length)).toEqual([{ rule: padded, from: 1, to: 4 }]);
    });

    it("returns UTF-16 offsets and rejects endpoints splitting a surrogate pair", () => {
        const emoji = rule("😀甲"), cat = rule("cat"), index = new VocabularyIndex([emoji, cat]);
        expect(index.find("😀甲😀cat.", 2)).toEqual([{ rule: emoji, from: 0, to: 3 }]);
        expect(index.find("😀甲😀cat.", 6)).toEqual([{ rule: cat, from: 5, to: 8 }]);
        for (const [from, to] of [[1, 1], [1, 3], [0, 4]]) expect(index.find("😀甲😀cat.", from, to)).toEqual([]);
    });

    it("sorts by source length in code points, occurrence position and rule order", () => {
        const first = rule("猫", "一"), second = rule("猫", "二"), face = rule("😀"), phrase = rule("猫猫");
        const index = new VocabularyIndex([face, second, rule("猫猫", "关闭", false), first, phrase]);
        expect(index.find("猫猫😀", 0, 4).map(hit => hit.rule)).toEqual([phrase, second, first, second, first, face]);
        expect(index.replacements("猫猫😀", 0, 4).map(group => group.rule)).toEqual([phrase, second, first, face]);
    });

    it("keeps whitespace literal in validation and matching", () => {
        const space = rule("　"), padded = rule(" 词 ", "  译 "), index = new VocabularyIndex([space, padded]);
        expect(vocabularyRuleIssue(space)).toBeNull();
        expect(vocabularyRuleIssue(padded)).toBeNull();
        expect(vocabularyRuleIssue(rule(""))).toBe("emptySource");
        expect(index.find("　 词 ", 0, 4)).toEqual([{ rule: padded, from: 1, to: 4 }, { rule: space, from: 0, to: 1 }]);
    });

    it("groups nonoverlapping hits from the left and keeps just the leftmost occurrence at a caret", () => {
        const pair = rule("哈哈"), index = new VocabularyIndex([pair]);
        expect(index.replacements("哈哈哈哈哈", 0, 5)).toEqual([{ rule: pair, ranges: [{ from: 0, to: 2 }, { from: 2, to: 4 }] }]);
        expect(index.replacements("哈哈哈哈哈", 2)).toEqual([{ rule: pair, ranges: [{ from: 0, to: 2 }] }]);
    });

    it("only returns exact substrings within the selection or touching the caret", () => {
        const character = fc.constantFrom("甲", "あ", "😀", "a", "0", " ", "_", ".");
        fc.assert(fc.property(fc.array(character, { minLength: 1, maxLength: 40 }), fc.nat(), fc.nat(), (chars, a, b) => {
            const text = chars.join(""), first = a % chars.length, last = b % chars.length;
            const rules = [rule(chars[first]), rule(chars.slice(Math.min(first, last), Math.max(first, last) + 1).join(""))];
            const index = new VocabularyIndex(rules);
            const positions = [a % (text.length + 1), b % (text.length + 1)].sort((x, y) => x - y);
            for (const [from, to] of [positions, [positions[0], positions[0]]]) {
                for (const hit of index.find(text, from, to)) {
                    expect(text.slice(hit.from, hit.to)).toBe(hit.rule.source);
                    expect(from === to ? hit.from <= from && from <= hit.to : from <= hit.from && hit.to <= to).toBe(true);
                }
            }
        }));
    });
});