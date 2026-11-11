import { type VocabularyRule } from "./Vocabulary";

// Offsets refer to the displayed UTF-16 text, never to tokens or source identities.
export type VocabularyMatch = { from: number; to: number; rule: VocabularyRule };
export type VocabularyGroup = { rule: VocabularyRule; ranges: { from: number; to: number }[] };
type Trie = { children: Map<string, Trie>; rules: VocabularyRule[] };
const trie = (): Trie => ({ children: new Map(), rules: [] });
const wordCharacter = (value: string): boolean => /[\p{Script=Latin}\p{Number}\p{Mark}_]/u.test(value);
const splitCharacter = (text: string, offset: number): boolean =>
    offset > 0 && offset < text.length && /[\uD800-\uDBFF]/u.test(text[offset - 1]) && /[\uDC00-\uDFFF]/u.test(text[offset]);

export class VocabularyIndex {
    private readonly root = trie();
    private readonly order = new Map<string, number>();
    private maximumLength = 0;

    constructor(rules: readonly VocabularyRule[]) {
        rules.forEach((rule, order) => {
            if (!rule.enabled || !rule.source) return;
            this.order.set(rule.id, order);
            this.maximumLength = Math.max(this.maximumLength, rule.source.length);
            let node = this.root;
            for (const character of rule.source) {
                let child = node.children.get(character);
                if (!child) node.children.set(character, child = trie());
                node = child;
            }
            node.rules.push(rule);
        });
    }

    replacements(text: string, from: number, to = from): VocabularyGroup[] {
        const groups = new Map<string, VocabularyGroup>();
        // find orders each rule's occurrences from left to right, and its first hit establishes menu order.
        for (const { rule, from: start, to: end } of this.find(text, from, to)) {
            const group = groups.get(rule.id);
            if (!group) groups.set(rule.id, { rule, ranges: [{ from: start, to: end }] });
            else if (from !== to && group.ranges[group.ranges.length - 1].to <= start) group.ranges.push({ from: start, to: end });
        }
        return [...groups.values()];
    }

    find(text: string, from: number, to = from): VocabularyMatch[] {
        if (from < 0 || to < from || to > text.length || !Number.isInteger(from) || !Number.isInteger(to)
            || splitCharacter(text, from) || splitCharacter(text, to)) return [];
        const selected = from !== to;
        const lower = selected ? from : Math.max(0, from - this.maximumLength);
        const upper = selected ? to : Math.min(text.length, to + this.maximumLength);
        const matches: VocabularyMatch[] = [];
        // Selection boundaries also delimit the matching context. No outside character influences a selection.
        const contextStart = selected ? from : 0, contextEnd = selected ? to : text.length;
        for (let start = lower + (splitCharacter(text, lower) ? 1 : 0); start < upper;) {
            if (!selected && start > from) break;
            let node = this.root, end = start;
            while (end < upper) {
                const character = String.fromCodePoint(text.codePointAt(end)!);
                const child = node.children.get(character);
                if (!child || end + character.length > upper) break;
                node = child;
                end += character.length;
                // A collapsed caret includes every occurrence touching either adjacent character.
                if (!node.rules.length || !selected && end < from) continue;
                const first = String.fromCodePoint(text.codePointAt(start)!);
                const last = character;
                const previous = start > contextStart ? Array.from(text.slice(Math.max(contextStart, start - 2), start)).at(-1)! : "";
                const next = end < contextEnd ? String.fromCodePoint(text.codePointAt(end)!) : "";
                if (wordCharacter(first) && wordCharacter(previous) || wordCharacter(last) && wordCharacter(next)) continue;
                for (const rule of node.rules) matches.push({ from: start, to: end, rule });
            }
            start += String.fromCodePoint(text.codePointAt(start)!).length;
        }
        return matches.sort((left, right) => Array.from(right.rule.source).length - Array.from(left.rule.source).length
            || left.from - right.from || this.order.get(left.rule.id)! - this.order.get(right.rule.id)!);
    }
}