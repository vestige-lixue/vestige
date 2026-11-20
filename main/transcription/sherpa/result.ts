import { type TranscriptSpan } from "../../../shared/transcription/Run";
import { type ParsedRequest } from "../parameters";
import { type NativeObject, type Piece, type RunDraft, object, array, number, probability, range, segments, createRun } from "../result";
import { VestigeErrors } from "../../../shared/failure";

const qwenLanguages: Record<string, string> = {
    chinese: "zh", english: "en", cantonese: "yue", arabic: "ar", german: "de", french: "fr", spanish: "es",
    portuguese: "pt", indonesian: "id", italian: "it", korean: "ko", russian: "ru", thai: "th", vietnamese: "vi",
    japanese: "ja", turkish: "tr", hindi: "hi", malay: "ms", dutch: "nl", swedish: "sv", danish: "da", finnish: "fi",
    polish: "pl", czech: "cs", filipino: "fil", persian: "fa", greek: "el", hungarian: "hu", macedonian: "mk", romanian: "ro"
};

type QwenHeader = { from: number; to: number; language: string };

function qwenHeaders(text: string): QwenHeader[] {
    const headers: QwenHeader[] = [];
    let previousEnd = 0;
    let declaration: RegExpExecArray | undefined;
    for (const match of text.matchAll(/\$?languages?\s+|<asr_text>/gi)) {
        if (!match[0].startsWith("<")) {
            declaration = match;
            continue;
        }
        if (!declaration) continue;
        // Only the declaration immediately preceding this marker belongs to the protocol.
        const language = text.slice(declaration.index + declaration[0].length, match.index).trim();
        if (/^[a-z]+(?:[ -]+[a-z]+)*$/i.test(language)) {
            const from = /[\p{L}\p{N}]/u.test(text.slice(previousEnd, declaration.index)) ? declaration.index : previousEnd;
            previousEnd = match.index + match[0].length;
            headers.push({ from, to: previousEnd, language: language.toLowerCase() });
        }
        declaration = undefined;
    }
    return headers;
}

export function normalizeQwenOutput(output: NativeObject): NativeObject {
    if (typeof output.text !== "string") return output;
    const headers = qwenHeaders(output.text);
    if (!headers.length) return output;
    let text = "", offset = 0;
    for (const header of headers) {
        text += output.text.slice(offset, header.from);
        offset = header.to;
    }
    text += output.text.slice(offset);
    if (headers[0].from === 0) text = text.trimStart();

    const tokens = array(output.tokens);
    const parts = tokens.every((part): part is string => typeof part === "string") ? tokens : [];
    // Native tokens can include whitespace omitted from text. Match in their own coordinate space.
    const spans = qwenHeaders(parts.join(""));
    const remaining: string[] = [], kept = new Set<number>();
    if (spans.length === headers.length && spans.every((span, i) => span.language === headers[i].language)) {
        let start = 0, h = 0;
        for (const [i, part] of parts.entries()) {
            const end = start + part.length;
            let body = "", cursor = start;
            while (h < spans.length && spans[h].from < end) {
                const span = spans[h];
                if (cursor < span.from) body += part.slice(cursor - start, span.from - start);
                cursor = Math.min(end, span.to);
                if (span.to > end) break;
                h++;
            }
            body += part.slice(cursor - start);
            const outsideHeader = h === spans.length || start < spans[h].from;
            if (body || !part && outsideHeader) {
                kept.add(i);
                remaining.push(body);
            }
            start = end;
        }
    }
    const keep = (value: unknown): unknown[] => array(value).filter((_, i) => kept.has(i));
    return { ...output, text, lang: qwenLanguages[headers[0].language] ?? output.lang,
        tokens: remaining, timestamps: keep(output.timestamps), durations: keep(output.durations), ys_log_probs: keep(output.ys_log_probs) };
}

export function parseBatchResults(raw: string, diagnostic: string, expected: number): unknown[] {
    const results: unknown[] = [];
    try {
        let start = 0;
        let depth = 0;
        let quoted = false;
        let escaped = false;
        let fragments: string[] = [];
        // Frame complete JSON values independently of line breaks in the output.
        for (let index = 0; index < raw.length; index++) {
            const character = raw[index];
            if (quoted) {
                if (escaped) escaped = false;
                else if (character === "\\") escaped = true;
                else if (character === "\"") quoted = false;
                else if (raw.charCodeAt(index) < 0x20) {
                    // Sherpa's std::quoted escapes quotes/backslashes but leaves
                    // control characters raw. Preserve existing JSON escapes.
                    fragments.push(raw.slice(start, index), `\\u${raw.charCodeAt(index).toString(16).padStart(4, "0")}`);
                    start = index + 1;
                }
            }
            else if (character === "\"") quoted = true;
            else if (character === "{" || character === "[") depth++;
            else if (character === "}" || character === "]") {
                depth--;
                if (depth === 0) {
                    results.push(JSON.parse(fragments.join("") + raw.slice(start, index + 1)));
                    fragments = [];
                    start = index + 1;
                }
            }
        }
        const remainder = fragments.join("") + raw.slice(start);
        if (remainder.trim()) results.push(JSON.parse(remainder));
    }
    catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new VestigeErrors({ kind: "transcription-invalid-result", reason: "json", cause: String(error), diagnostic: diagnostic || raw }, { cause: error });
    }
    if (results.length !== expected) throw new VestigeErrors({ kind: "transcription-invalid-result", reason: "count", expected, actual: results.length, diagnostic: diagnostic || raw });
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
    if (typeof output.text !== "string") throw new VestigeErrors({ kind: "transcription-invalid-output", executor: "sherpa-onnx", field: "text" });
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

export function toRun(id: string, request: ParsedRequest, value: unknown, duration: number, runTime: number, qwen = false): RunDraft {
    const output = qwen ? normalizeQwenOutput(object(value)) : object(value);
    return createRun(id, request, output.lang, sherpaTranscript(output, duration), runTime);
}