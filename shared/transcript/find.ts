import { firstTrue } from "../util/search";

export type FindOptions = { caseSensitive: boolean; wholeWord: boolean };
export type FindOccurrence = { from: number; to: number };

/** Half-open displayed UTF-16 offsets, shared by all transcript painting. */
export type TextWindow = { from: number; to: number };

/** Map displayed offsets through PM positions, keeping insertions on either boundary inside the window. */
export function mapTextWindow(window: TextWindow, length: number, map: (position: number, association: number) => number): TextWindow {
    const clamp = (position: number): number => Math.max(0, Math.min(length, position - 1));
    const from = clamp(map(window.from + 1, -1));
    return { from, to: Math.max(from, clamp(map(window.to + 1, 1))) };
}

export function intersectTextWindow(range: TextWindow, window: TextWindow): TextWindow | null {
    const from = Math.max(range.from, window.from), to = Math.min(range.to, window.to);
    return from < to ? { from, to } : null;
}

export function bufferTextWindow(visible: TextWindow, length: number): TextWindow {
    const from = Math.max(0, Math.min(length, visible.from)), to = Math.max(from, Math.min(length, visible.to));
    const buffer = Math.max(1, to - from);
    return { from: Math.max(0, from - buffer), to: Math.min(length, to + buffer) };
}

/** Sorted nonoverlapping matches intersecting the window, plus the current match even outside it. */
export function windowOccurrenceIndices(matches: readonly FindOccurrence[], window: TextWindow, current = -1): number[] {
    const first = firstTrue(matches.length, i => matches[i].to > window.from);
    const end = window.from < window.to ? firstTrue(matches.length, i => matches[i].from >= window.to) : first;
    const indices = Array.from({ length: Math.max(0, end - first) }, (_, i) => first + i);
    if (current >= 0 && current < matches.length && (current < first || current >= end)) {
        if (current < first) indices.unshift(current);
        else indices.push(current);
    }
    return indices;
}

export function preserveReplacementCase(match: string, replacement: string): string {
    if (!replacement) return replacement;
    const cased = Array.from(match).filter(character => character.toUpperCase() !== character.toLowerCase());
    if (!cased.length) return replacement;
    if (cased.every(character => character === character.toUpperCase())) return replacement.toUpperCase();
    if (cased.every(character => character === character.toLowerCase())) return replacement.toLowerCase();
    if (cased[0] !== cased[0].toUpperCase()) return replacement;
    const first = String.fromCodePoint(replacement.codePointAt(0)!);
    return first.toUpperCase() + replacement.slice(first.length);
}

const wordCharacter = /[\p{L}\p{N}\p{M}\p{Pc}]/u;

function fold(character: string): string {
    const lower = character.toLowerCase();
    return lower === character || lower.length === 1 || lower.length === 2 && lower.codePointAt(0)! > 0xffff ? lower : character;
}

export function findOccurrences(text: string, query: string, options: FindOptions = { caseSensitive: false, wholeWord: false }): FindOccurrence[] {
    if (!query) return [];
    const { caseSensitive, wholeWord } = options;
    const characters = Array.from(text);
    const pattern = Array.from(query, character => caseSensitive ? character : fold(character));
    // KMP keeps long, repeated queries linear too. Only the original code points supply offsets.
    const prefix = new Uint32Array(pattern.length);
    for (let i = 1, matched = 0; i < pattern.length; i++) {
        while (matched && pattern[i] !== pattern[matched]) matched = prefix[matched - 1];
        if (pattern[i] === pattern[matched]) matched++;
        prefix[i] = matched;
    }
    const offsets = new Uint32Array(characters.length + 1);
    const occurrences: FindOccurrence[] = [];
    for (let i = 0, matched = 0; i < characters.length; i++) {
        offsets[i + 1] = offsets[i] + characters[i].length;
        const character = caseSensitive ? characters[i] : fold(characters[i]);
        while (matched && character !== pattern[matched]) matched = prefix[matched - 1];
        if (character === pattern[matched]) matched++;
        if (matched !== pattern.length) continue;
        const start = i + 1 - pattern.length;
        const boundary = !wholeWord
            || (start === 0 || !wordCharacter.test(characters[start - 1]) || !wordCharacter.test(characters[start]))
            && (i + 1 === characters.length || !wordCharacter.test(characters[i + 1]) || !wordCharacter.test(characters[i]));
        if (boundary) {
            occurrences.push({ from: offsets[start], to: offsets[i + 1] });
            matched = 0;
        }
        else matched = prefix[matched - 1];
    }
    return occurrences;
}