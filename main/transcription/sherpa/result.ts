import { type Run, type TranscriptSpan } from "../../../shared/transcription/Run";
import { type ParsedRequest } from "../parameters";
import { type NativeObject, type Piece, object, array, number, probability, range, segments, createRun } from "../result";
import { TranscriptionFailure } from "../failure";

const qwenLanguages: Record<string, string> = {
    chinese: "zh", english: "en", cantonese: "yue", arabic: "ar", german: "de", french: "fr", spanish: "es",
    portuguese: "pt", indonesian: "id", italian: "it", korean: "ko", russian: "ru", thai: "th", vietnamese: "vi",
    japanese: "ja", turkish: "tr", hindi: "hi", malay: "ms", dutch: "nl", swedish: "sv", danish: "da", finnish: "fi",
    polish: "pl", czech: "cs", filipino: "fil", persian: "fa", greek: "el", hungarian: "hu", macedonian: "mk", romanian: "ro"
};

export function normalizeQwenOutput(output: NativeObject): NativeObject {
    if (typeof output.text !== "string") return output;
    // Some 1.7B exports emit $LANGUAGE instead of the lowercase prefix stripped
    // by sherpa. Only remove a complete leading protocol header, never words
    // such as "language" that may themselves be the spoken transcript.
    const prefix = /^\s*\$?languages?\s+([A-Za-z][A-Za-z -]{0,40})<asr_text>/i.exec(output.text);
    if (!prefix) return output;
    return {
        ...output,
        text: output.text.slice(prefix[0].length).trimStart(),
        lang: qwenLanguages[prefix[1].trim().toLowerCase()] ?? output.lang,
        tokens: [], timestamps: [], durations: [], ys_log_probs: []
    };
}

export function parseBatchResults(raw: string, diagnostic: string, expected: number): unknown[] {
    let results: unknown[];
    try {
        results = expected === 1 ? [JSON.parse(raw)] : raw.trim().split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
    }
    catch (error) {
        throw new TranscriptionFailure({ kind: "transcription-invalid-result", diagnostic: diagnostic || raw }, { cause: error });
    }
    if (results.length !== expected) throw new TranscriptionFailure({ kind: "transcription-invalid-result", diagnostic: diagnostic || raw });
    return results;
}

export function needsWordSeparator(previous: string, next: string): boolean {
    if (/\s$/.test(previous) || /^\s/.test(next)) return false;
    const last = /([\p{L}\p{N}])[^\p{L}\p{N}]*$/u.exec(previous)?.[1];
    const first = /^["“‘«([{]*([\p{L}\p{N}])/u.exec(next)?.[1];
    // Independent windows omit the leading space that a continuous decoder
    // would emit. Keep scripts without word spaces unchanged.
    const unspaced = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
    return !!last && !!first && !unspaced.test(last + first);
}

function sherpaTranscript(output: NativeObject, duration: number): TranscriptSpan[] {
    if (typeof output.text !== "string") throw new TranscriptionFailure({ kind: "transcription-invalid-output", executor: "sherpa-onnx", field: "text" });
    const tokens = array(output.tokens);
    const timestamps = array(output.timestamps);
    const durations = array(output.durations);
    const logProbs = array(output.ys_log_probs);
    const pieces = tokens.map((token, index): Piece => {
        const start = number(timestamps[index]);
        const length = number(durations[index]);
        const end = start !== undefined && length !== undefined ? start + length : timestamps[index + 1] ?? duration;
        const logProb = number(logProbs[index]);
        return {
            text: typeof token === "string" ? token.replace(/▁/g, " ").replace(/@@$/g, "") : "",
            range: range(start, end),
            prob: logProb === undefined ? 1 : probability(Math.exp(logProb))
        };
    });
    const tokenSegments = segments(output.text, pieces, { start: 0, end: duration });
    if (pieces.length && pieces.every(piece => piece.range) && tokenSegments.length > 1) return tokenSegments;

    const texts = array(output.segment_texts);
    const starts = array(output.segment_timestamps);
    const lengths = array(output.segment_durations);
    if (texts.length && texts.every(text => typeof text === "string") && texts.join("") === output.text) {
        return texts.map((text, index) => {
            const start = number(starts[index]);
            const length = number(lengths[index]);
            return {
                range: range(start, start !== undefined && length !== undefined ? start + length : undefined)
                    ?? { start: 0, end: duration },
                blankProb: 0,
                token: { text: text as string, prob: 1 }
            };
        });
    }
    return tokenSegments;
}

export function toRun(id: string, request: ParsedRequest, value: unknown, duration: number, runTime: number, qwen = false): Run {
    const output = qwen ? normalizeQwenOutput(object(value)) : object(value);
    return createRun(id, request, output.lang, sherpaTranscript(output, duration), runTime);
}