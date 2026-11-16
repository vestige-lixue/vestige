import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { resolve } from "node:path";
import { normalizeQwenOutput, parseBatchResults, toRun } from "../main/transcription/sherpa/result";
import qwenProtocol from "./support/qwen-protocol.json";
import { type ParsedRequest } from "../main/transcription/parameters";
import { VestigeErrors } from "../shared/failure";
import { type AbsolutePath } from "../shared/util/path";
import { checkProperty } from "./support/properties";

const diagnostic = "Started\r\nDone!\r\n";

function sherpaResult(text: string, tokens: string[] = [text]): string {
    // sherpa-onnx v1.13.8 uses std::quoted: only quotes and backslashes are escaped.
    const quote = (value: string): string => `"${value.replace(/[\\"]/g, "\\$&")}"`;
    return `{"lang": "zh", "text": ${quote(text)}, "tokens": [${tokens.map(quote).join(", ")}], "timestamps": [], "durations": []}`;
}

describe("Sherpa batch results", () => {
    it.each(["\n", "\r\n", "\r"])("preserves raw %j line breaks in text and tokens", newline => {
        const tokens = [newline, "第一行", newline, newline, "第二行", newline];
        const text = tokens.join("");
        expect(parseBatchResults(sherpaResult(text, tokens), diagnostic, 1)).toEqual([
            { lang: "zh", text, tokens, timestamps: [], durations: [] }
        ]);
    });

    it("keeps four batch results aligned when the second contains raw line breaks", () => {
        const texts = ["第一段", "第二段\r\n继续\r\n结束", "", "第四段"];
        const raw = texts.map(text => sherpaResult(text)).join("\r\n") + "\r\n";
        expect(parseBatchResults(raw, diagnostic, 4)).toEqual(texts.map(text => ({
            lang: "zh", text, tokens: [text], timestamps: [], durations: []
        })));
    });

    it("escapes all raw controls while preserving quotes, backslashes and Unicode", () => {
        const controls = Array.from({ length: 32 }, (_, code) => String.fromCharCode(code)).join("");
        const tokens = [String.raw`C:\new\test \n \u0041 \\`, "\"quoted\" {[braces]}", controls, "\\", "中文𠮷😀\u2028\u2029"];
        const text = tokens.join("");
        expect(parseBatchResults(sherpaResult(text, tokens), diagnostic, 1)).toEqual([
            { lang: "zh", text, tokens, timestamps: [], durations: [] }
        ]);
    });

    it("preserves existing JSON escapes without interpreting literal backslashes twice", () => {
        const raw = String.raw`{"text":"line\nquote: \" path: C:\\new literal: \\n unicode: \u4e2d slash: \/","tokens":["\\","\t","\b\f\r","\ud83d\ude00"]}`;
        expect(parseBatchResults(raw, diagnostic, 1)).toEqual([JSON.parse(raw)]);
    });

    it.each(["\r\n\r\n", " ", ""])("finds complete objects separated by %j with nested and formatted JSON", separator => {
        const values = [
            { text: "braces } { and quote \"\n", metadata: { values: ["[]", { text: "nested" }] } },
            { text: "next", tokens: ["next"] }
        ];
        const raw = " \r\n" + values.map(value => JSON.stringify(value, null, 2)).join(separator) + "\r\n ";
        expect(parseBatchResults(raw, diagnostic, values.length)).toEqual(values);
    });

    it("preserves line breaks through transcription span creation", () => {
        const tokens = ["第一行", "\n\n", "第二行\\n", "\n"];
        const text = tokens.join("");
        const [value] = parseBatchResults(sherpaResult(text, tokens), diagnostic, 1);
        const request: ParsedRequest = {
            executor: "sherpa-onnx", backendDirectory: "fixture", modelDirectory: resolve("fixture") as AbsolutePath,
            mediaPath: resolve("fixture.wav") as AbsolutePath, mediaDuration: 4, params: {}, startedAt: 0,
            config: { executor: "sherpa-onnx", backendDirectory: "fixture", modelDirectory: "fixture", params: {} }
        };
        const run = toRun("fixture", request, value, 4, 0, true);
        expect(run.transcript.map(span => span.token.text).join("")).toBe(text);
    });

    it("round-trips generated batches from native quoting and proper JSON serialization", () => {
        const token = fc.oneof(fc.string(), fc.constantFrom("\n", "\r\n", "\t", "\0", "\\", "\"", "}{", "😀"));
        const batch = fc.array(fc.array(token, { maxLength: 12 }), { minLength: 1, maxLength: 4 });
        checkProperty("sherpa-json-output", fc.property(batch, tokens => {
            const values = tokens.map(parts => ({ lang: "zh", text: parts.join(""), tokens: parts, timestamps: [], durations: [] }));
            const native = tokens.map(parts => sherpaResult(parts.join(""), parts)).join("\r\n");
            const standard = values.map(value => JSON.stringify(value, null, 2)).join("\n");
            expect(parseBatchResults(native, diagnostic, values.length)).toEqual(values);
            expect(parseBatchResults(standard, diagnostic, values.length)).toEqual(values);
        }));
    });

    it.each([
        "{\"text\":\"unfinished\n",
        String.raw`{"text":"invalid\q"}`,
        "{\"text\":\"one\" \"tokens\":[]}",
        "{\"text\":\"one\",}",
        "{\"text\":\"one\",\"tokens\":[}}",
        "noise\n{\"text\":\"one\"}",
        "{\"text\":\"one\"}\nnoise",
        "{\"text\":\"one\"}\n{\"text\":\"unfinished"
    ])("rejects malformed output instead of silently skipping it: %j", raw => {
        expect(() => parseBatchResults(raw, diagnostic, 1)).toThrowError(VestigeErrors);
    });

    it.each([0, 1, 3])("rejects a batch with %i results when two are expected", count => {
        const raw = Array.from({ length: count }, () => sherpaResult("sample")).join("\n");
        expect(() => parseBatchResults(raw, diagnostic, 2)).toThrowError("transcription-invalid-result");
    });

    it("retains the original native diagnostic and parsing exception on failure", () => {
        let failure: unknown;
        try {
            parseBatchResults("{\"text\":", diagnostic, 1);
        }
        catch (error) {
            failure = error;
        }
        expect(failure).toMatchObject({
            failure: { kind: "transcription-invalid-result", diagnostic }, cause: expect.any(SyntaxError)
        });
    });
});

describe("Qwen protocol tokens", () => {
    const request: ParsedRequest = {
        executor: "sherpa-onnx", backendDirectory: "fixture", modelDirectory: resolve("fixture") as AbsolutePath,
        mediaPath: resolve("fixture.wav") as AbsolutePath, mediaDuration: 20, params: {}, startedAt: 0,
        config: { executor: "sherpa-onnx", backendDirectory: "fixture", modelDirectory: "fixture", params: {} }
    };

    it("preserves every body token from the real Qwen output", () => {
        const normalized = normalizeQwenOutput(qwenProtocol);
        expect(normalized).toMatchObject({
            text: qwenProtocol.text.split("<asr_text>")[1], lang: "en",
            tokens: qwenProtocol.tokens.slice(3), timestamps: [], durations: [], ys_log_probs: []
        });
        const run = toRun("fixture", request, qwenProtocol, 20, 0, true);
        expect(run.language).toBe("en");
        expect(run.transcript.map(span => span.token.text)).toEqual(qwenProtocol.tokens.slice(3));
        expect(run.transcript[0]).toMatchObject({ token: { text: "Do" }, range: { start: 0, end: 20 } });
    });

    it.each(["language", "$LANGUAGE", "$LANGUAGES"])("keeps the body inside a header-ending token for %s", protocol => {
        const output = {
            text: `  ${protocol} English<asr_text>Do you`,
            tokens: [" ", protocol, " English", "<asr_text>Do", " you"],
            timestamps: [0, 1, 2, 3, 4], durations: [1, 1, 1, 1, 1], ys_log_probs: [-5, -4, -3, -2, -1]
        };
        expect(normalizeQwenOutput(output)).toMatchObject({
            text: "Do you", lang: "en", tokens: ["Do", " you"],
            timestamps: [3, 4], durations: [1, 1], ys_log_probs: [-2, -1]
        });
        expect(toRun("fixture", request, output, 20, 0, true).transcript.map(span => span.token.text)).toEqual(["Do", " you"]);
    });

    it("removes matching timing and probability entries with complete header tokens", () => {
        expect(normalizeQwenOutput({
            ...qwenProtocol, timestamps: qwenProtocol.tokens.map((_, index) => index),
            durations: qwenProtocol.tokens.map(() => 1), ys_log_probs: qwenProtocol.tokens.map(() => -1)
        })).toMatchObject({
            timestamps: qwenProtocol.tokens.slice(3).map((_, index) => index + 3),
            durations: qwenProtocol.tokens.slice(3).map(() => 1), ys_log_probs: qwenProtocol.tokens.slice(3).map(() => -1)
        });
    });

    it.each([[" language", " French", "<asr_text>", "Do", " you"], [" language"], [" language", 42]])(
        "falls back to the whole body when header tokens disagree: %j", (...tokens) => {
            const output = { text: "language English<asr_text>Do you", tokens, timestamps: [1], durations: [1], ys_log_probs: [-1] };
            expect(normalizeQwenOutput(output)).toMatchObject({ text: "Do you", lang: "en", tokens: [], timestamps: [], durations: [], ys_log_probs: [] });
            expect(toRun("fixture", request, output, 20, 0, true).transcript).toEqual([
                { range: { start: 0, end: 20 }, blankProb: 0, token: { text: "Do you", prob: 1 } }
            ]);
        }
    );

    it("leaves output without a complete protocol header unchanged", () => {
        const output = { text: "language is useful", lang: "en", tokens: ["language", " is", " useful"], timestamps: [0, 1, 2], durations: [1, 1, 1] };
        expect(normalizeQwenOutput(output)).toBe(output);
        expect(toRun("fixture", request, output, 20, 0, true)).toEqual(toRun("fixture", request, output, 20, 0));
    });
});