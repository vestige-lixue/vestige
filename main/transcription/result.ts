import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { type Range } from "../../shared/util/range";
import { type Run, type Segment } from "../../shared/transcription/Run";
import { type ParsedRequest } from "./parameters";

export type NativeObject = Record<string, unknown>;
export type Piece = { text: string; range?: Range; prob: number };

export function object(value: unknown): NativeObject {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as NativeObject : {};
}

export function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

export function number(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function probability(value: unknown, fallback = 1): number {
    const result = number(value);
    return result === undefined ? fallback : Math.min(1, Math.max(0, result));
}

export function range(start: unknown, end: unknown, duration: number, scale = 1): Range | undefined {
    const from = number(start);
    const to = number(end);
    if (from === undefined || to === undefined || from < 0 || to < from) return undefined;
    return { start: Math.min(duration, from * scale), end: Math.min(duration, to * scale) };
}

export function segments(text: string, pieces: Piece[], fallback: Range, blankProb = 0): Segment[] {
    if (!text) return [];
    const joined = pieces.map(piece => piece.text).join("");
    const offset = joined.indexOf(text);
    // Use native token boundaries only if they reproduce the actual transcript.
    // ITN/BPE differences must not silently replace or drop recognized text.
    if (!pieces.length || offset < 0
        || joined.slice(0, offset).trim() || joined.slice(offset + text.length).trim()) {
        return [{ range: fallback, blankProb, token: { text, prob: 1 } }];
    }
    let cursor = 0;
    const result: Segment[] = [];
    for (const piece of pieces) {
        const start = Math.max(0, offset - cursor);
        const end = Math.min(piece.text.length, offset + text.length - cursor);
        const tokenText = piece.text.slice(start, Math.max(start, end));
        cursor += piece.text.length;
        if (tokenText) result.push({ range: piece.range ?? fallback, blankProb, token: { text: tokenText, prob: piece.prob } });
    }
    return result;
}

export function parseResult(raw: string, diagnostic: string): unknown {
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(diagnostic || raw || "Executer produced no JSON result.");
    }
}

export function createRun(request: ParsedRequest, language: unknown, transcript: Segment[], runTime: number): Run {
    return {
        id: randomUUID(),
        modelName: basename(request.modelDirectory),
        params: request.params,
        language: typeof language === "string" && language.trim() ? language : "und",
        languageProb: 1,
        runTime,
        transcript
    };
}