import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { resolve } from "node:path";
import { parseWhisperResult } from "../main/transcription/whisper/bytes";
import { toRun } from "../main/transcription/whisper/result";
import { type ParsedRequest } from "../main/transcription/parameters";
import { type AbsolutePath } from "../shared/util/path";
import { whisperResult } from "./support/whisper";
import { checkProperty } from "./support/properties";

const request: ParsedRequest = {
    executor: "whisper.cpp", backendDirectory: "fixture", modelDirectory: resolve("fixture") as AbsolutePath,
    mediaPath: resolve("fixture.wav") as AbsolutePath, mediaDuration: 4, params: {}, startedAt: 0,
    config: { executor: "whisper.cpp", backendDirectory: "fixture", modelDirectory: "fixture", params: {} }
};
const parse = (raw: Buffer): ReturnType<typeof toRun> => toRun("fixture", request, parseWhisperResult(raw, ""), 4, 0);

describe("Whisper byte results", () => {
    it("merges a Chinese character split between tokens with their time union and minimum probability", () => {
        const run = parse(whisperResult([{ text: "中", no_speech_prob: 0.25, tokens: [
            { text: [0xe4], offsets: { from: 500, to: 1000 }, p: 0.8 },
            { text: [0xb8, 0xad], offsets: { from: 200, to: 800 }, p: 0.6 }
        ] }]));
        expect(run.language).toBe("zh");
        expect(run.transcript).toEqual([
            { token: { text: "中", prob: 0.6 }, range: { start: 0.2, end: 1 }, blankProb: 0.25 }
        ]);
    });

    it("merges only boundaries crossed by a character among four source tokens", () => {
        const run = parse(whisperResult([{ text: "中文!", tokens: [
            { text: "中", offsets: { from: 0, to: 100 } },
            { text: [0xe6, 0x96], offsets: { from: 100, to: 200 }, p: 0.7 },
            { text: [0x87], offsets: { from: 200, to: 300 }, p: 0.9 },
            { text: "!", offsets: { from: 300, to: 400 } }
        ] }]));
        expect(run.transcript.map(span => span.token.text)).toEqual(["中", "文", "!"]);
        expect(run.transcript[1]).toMatchObject({ range: { start: 0.1, end: 0.3 }, token: { prob: 0.7 } });
    });

    it("preserves ASCII text, escapes, controls, timing, probability and fallback behavior", () => {
        const raw = whisperResult([
            { text: " Hello \"world\"\\\n", no_speech_prob: 0.1, tokens: [
                { text: "[_BEG_]", id: 50364 },
                { text: " Hello", offsets: { from: 100, to: 600 }, p: 0.8 },
                { text: " \"world\"\\\n", offsets: { from: 600, to: 1000 }, p: 0.7 },
                { text: "<|endoftext|>", id: 50257 }
            ] },
            { text: "missing token", tokens: [] }
        ]);
        expect(parse(raw)).toEqual(toRun("fixture", request, JSON.parse(raw.toString("utf8")), 4, 0));
        expect(parse(raw).transcript).toHaveLength(3);
    });

    it("moves tokens completing a character in the next segment to the previous segment", () => {
        const raw = whisperResult([
            { text: [0x41, 0xe4], offsets: { from: 0, to: 1000 }, no_speech_prob: 0.1, tokens: [
                { text: "A", offsets: { from: 0, to: 100 }, p: 0.9 },
                { text: [0xe4], offsets: { from: 100, to: 1000 }, p: 0.8 },
                { text: "[_TT_100]", id: 50365 }
            ] },
            { text: [0xb8, 0xad, 0x42, 0x43], offsets: { from: 1000, to: 2000 }, no_speech_prob: 0.2, tokens: [
                { text: "[_BEG_]", id: 50364 },
                { text: [0xb8], offsets: { from: 1000, to: 1100 }, p: 0.7 },
                { text: [0xad, 0x42], offsets: { from: 1100, to: 1200 }, p: 0.6 },
                { text: "C", offsets: { from: 1200, to: 2000 }, p: 0.9 }
            ] }
        ]);
        expect(parseWhisperResult(raw, "")).toMatchObject({ transcription: [{ text: "A中B" }, { text: "C" }] });
        expect(parse(raw).transcript).toEqual([
            { token: { text: "A", prob: 0.9 }, range: { start: 0, end: 0.1 }, blankProb: 0.1 },
            { token: { text: "中B", prob: 0.6 }, range: { start: 0.1, end: 1.2 }, blankProb: 0.1 },
            { token: { text: "C", prob: 0.9 }, range: { start: 1.2, end: 2 }, blankProb: 0.2 }
        ]);
    });

    it.each(["metadata", "text", "token"])("falls back for the whole file when %s contains escaped Unicode", field => {
        const base = whisperResult([{ text: "中文", tokens: [{ text: "中" }, { text: "文" }] }]).toString("latin1");
        const escaped = field === "metadata" ? base.replace("\"result\":", "\"extra\":{\"note\":\"\\u4e2d\"},\"result\":")
            : base.replace(field === "text" ? Buffer.from("中文").toString("latin1") : Buffer.from("中").toString("latin1") + "\"", field === "text" ? "\\u4e2d\\u6587" : "\\u4e2d\"");
        const raw = Buffer.from(escaped, "latin1");
        expect(parseWhisperResult(raw, "")).toEqual(JSON.parse(raw.toString("utf8")));
    });

    it.each([
        [0xff], [0xe4, 0x41], [0xe4, 0xb8], [0xe0, 0x80, 0x80],
        [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe1, 0x80, 0x41]
    ])("decodes genuinely invalid bytes with TextDecoder replacement rules: %j", (...bytes) => {
        const expected = new TextDecoder().decode(Buffer.from(bytes));
        const raw = whisperResult([{ text: bytes, tokens: bytes.map(byte => ({ text: [byte] })) }]);
        const run = parse(raw);
        expect(run.transcript.map(span => span.token.text).join("")).toBe(expected);
    });

    it.each([[0x41], [0xb8], [0xb8, 0x41]])("leaves an incomplete segment unchanged when the next bytes cannot complete it: %j", (...next) => {
        const raw = whisperResult([
            { text: [0xe4], tokens: [{ text: [0xe4] }] },
            { text: next, tokens: [{ text: next }] }
        ]);
        expect(parseWhisperResult(raw, "")).toMatchObject({ transcription: [
            { text: "�" }, { text: new TextDecoder().decode(Buffer.from(next)) }
        ] });
    });

    it("merges chained splits including four-byte Unicode without losing neighboring token text", () => {
        const raw = whisperResult([{ text: "A中😀Z", tokens: [
            { text: [0x41, 0xe4] }, { text: [0xb8, 0xad, 0xf0] }, { text: [0x9f] }, { text: [0x98, 0x80] }, { text: "Z" }
        ] }]);
        expect(parse(raw).transcript.map(span => span.token.text)).toEqual(["A中😀", "Z"]);
    });

    it("reproduces TextDecoder output for arbitrary byte sequences and token boundaries", () => {
        checkProperty("whisper-token-bytes", fc.property(
            fc.array(fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 12 }), { maxLength: 12 }), tokens => {
                const bytes = tokens.flat();
                const expected = new TextDecoder("utf-8", { ignoreBOM: true }).decode(Buffer.from(bytes));
                const raw = whisperResult([{ text: bytes, tokens: tokens.map(text => ({ text })) }]);
                const result = parseWhisperResult(raw, "") as { transcription: { text: string; tokens: { text: string }[] }[] };
                expect(result.transcription[0].text).toBe(expected);
                expect(result.transcription[0].tokens.map(token => token.text).join("")).toBe(expected);
            }
        ));
    });

    it("keeps malformed JSON diagnostics in UTF-8", () => {
        const raw = Buffer.from("{\"中文\":");
        expect(() => parseWhisperResult(raw, "")).toThrowError(expect.objectContaining({
            failure: expect.objectContaining({ kind: "transcription-invalid-result", reason: "json", diagnostic: raw.toString("utf8") }),
            cause: expect.any(SyntaxError)
        }));
        expect(() => parseWhisperResult(raw, "native diagnostic")).toThrowError(expect.objectContaining({
            failure: expect.objectContaining({ diagnostic: "native diagnostic" })
        }));
    });
});