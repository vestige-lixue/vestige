import { type Range } from "../../shared/util/range";
import { type Run, type TranscriptSpan } from "../../shared/transcription/Run";
import { type ParsedRequest } from "./parameters";
import { VestigeErrors } from "../../shared/failure";

export type NativeObject = Record<string, unknown>;
export type Piece = { text: string; range?: Range; prob: number };
export type RunDraft = Omit<Run, "execution">;

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

export function range(start: unknown, end: unknown, scale = 1): Range | undefined {
    const from = number(start);
    const to = number(end);
    if (from === undefined || to === undefined || from < 0 || to < from) return undefined;
    const result = { start: from * scale, end: to * scale };
    return Number.isFinite(result.start) && Number.isFinite(result.end) ? result : undefined;
}

export function segments(text: string, pieces: Piece[], fallback: Range, blankProb = 0): TranscriptSpan[] {
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
    const result: TranscriptSpan[] = [];
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
    catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new VestigeErrors({ kind: "transcription-invalid-result", diagnostic: diagnostic || raw }, { cause: error });
    }
}

export function createRun(id: string, request: ParsedRequest, language: unknown, transcript: TranscriptSpan[], runTime: number): RunDraft {
    return {
        id,
        startedAt: request.startedAt,
        config: { ...request.config, params: { ...request.config.params } },
        language: typeof language === "string" && language.trim() ? language : "und",
        languageProb: 1,
        runTime,
        transcript
    };
}