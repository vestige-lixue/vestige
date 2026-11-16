import { array, object, parseResult, probability, range, type NativeObject } from "../result";

export function textTokens(segment: NativeObject): NativeObject[] {
    return array(segment.tokens).map(object).filter(token => {
        // The full JSON includes decoder control tokens as well as text.
        return typeof token.text === "string" && !(typeof token.id === "number" && token.id >= 50256
            && /^(\[_.*\]|<\|.*\|>)$/.test(token.text));
    });
}

function hasWideString(value: unknown): boolean {
    if (typeof value === "string") return /[\u0100-\uffff]/.test(value);
    if (Array.isArray(value)) return value.some(hasWideString);
    return value !== null && typeof value === "object"
        && Object.entries(value).some(([key, item]) => hasWideString(key) || hasWideString(item));
}

function decodeStrings(value: unknown): unknown {
    if (typeof value === "string") return Buffer.from(value, "latin1").toString("utf8");
    if (Array.isArray(value)) return value.map(decodeStrings);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [decodeStrings(key), decodeStrings(item)]));
    }
    return value;
}

// Consume one UTF-8 scalar or maximal invalid subsequence, as TextDecoder does.
// A bad continuation is reconsidered as the start of the next subsequence.
function utf8Unit(bytes: Buffer, start: number): { end: number; missing: number } {
    const lead = bytes[start];
    const length = lead >= 0xc2 && lead <= 0xdf ? 2
        : lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 1;
    for (let index = 1; index < length; index++) {
        if (start + index === bytes.length) return { end: bytes.length, missing: length - index };
        const byte = bytes[start + index];
        const lower = index === 1 && (lead === 0xe0 || lead === 0xf0) ? (lead === 0xe0 ? 0xa0 : 0x90) : 0x80;
        const upper = index === 1 && (lead === 0xed || lead === 0xf4) ? (lead === 0xed ? 0x9f : 0x8f) : 0xbf;
        if (byte < lower || byte > upper) return { end: start + index, missing: 0 };
    }
    return { end: start + length, missing: 0 };
}

function mergeTokens(tokens: NativeObject[]): NativeObject {
    if (tokens.length === 1) return { ...tokens[0] };
    const times = tokens.flatMap(token => {
        const offsets = object(token.offsets);
        const time = range(offsets.from, offsets.to);
        return time ? [time] : [];
    });
    return {
        ...tokens[0],
        text: tokens.map(token => token.text).join(""),
        offsets: times.length ? { from: Math.min(...times.map(time => time.start)), to: Math.max(...times.map(time => time.end)) } : {},
        p: Math.min(...tokens.map(token => probability(token.p)))
    };
}

function decodeTokens(tokens: NativeObject[]): NativeObject[] {
    const buffers = tokens.map(token => Buffer.from(token.text as string, "latin1"));
    const bytes = Buffer.concat(buffers);
    const owners = buffers.flatMap((buffer, index) => Array<number>(buffer.length).fill(index));
    const through = tokens.map((_, index) => index);
    for (let start = 0; start < bytes.length;) {
        const { end } = utf8Unit(bytes, start);
        through[owners[start]] = Math.max(through[owners[start]], owners[end - 1]);
        start = end;
    }
    const result: NativeObject[] = [];
    for (let start = 0; start < tokens.length;) {
        let end = through[start];
        for (let index = start + 1; index <= end; index++) end = Math.max(end, through[index]);
        const token = mergeTokens(tokens.slice(start, end + 1));
        result.push({ ...token, text: Buffer.from(token.text as string, "latin1").toString("utf8") });
        start = end + 1;
    }
    return result;
}

function repairSegmentBoundary(previous: NativeObject, next: NativeObject): void {
    if (typeof previous.text !== "string" || typeof next.text !== "string") return;
    const before = textTokens(previous);
    const after = textTokens(next);
    const bytes = Buffer.from(before.map(token => token.text).join(""), "latin1");
    let tail = bytes.length;
    let missing = 0;
    for (let start = 0; start < bytes.length;) {
        const unit = utf8Unit(bytes, start);
        if (unit.missing) {
            tail = start;
            missing = unit.missing;
        }
        start = unit.end;
    }
    if (!missing) return;
    const suffix = bytes.subarray(tail);
    let moved = "";
    let count = 0;
    while (count < after.length && moved.length < missing) moved += after[count++].text;
    if (moved.length < missing) return;
    const combined = Buffer.concat([suffix, Buffer.from(moved.slice(0, missing), "latin1")]);
    // Only move complete source tokens when their leading bytes finish this
    // character, and the segment texts agree with the bytes being moved.
    if (utf8Unit(combined, 0).end !== combined.length || utf8Unit(combined, 0).missing
        || !previous.text.endsWith(suffix.toString("latin1")) || !next.text.startsWith(moved)) return;
    previous.tokens = [...before, ...after.slice(0, count)];
    next.tokens = after.slice(count);
    previous.text += moved;
    next.text = next.text.slice(moved.length);
}

export function parseWhisperResult(raw: Buffer, diagnostic: string): unknown {
    let value: unknown;
    try {
        value = JSON.parse(raw.toString("latin1"));
    }
    catch {
        // Keep the existing UTF-8 diagnostic and SyntaxError on malformed JSON.
        return parseResult(raw.toString("utf8"), diagnostic);
    }
    // Escaped Unicode cannot be treated as raw bytes. Fall back for the whole
    // file, including token strings, rather than mixing the two encodings.
    if (hasWideString(value)) return parseResult(raw.toString("utf8"), diagnostic);
    const transcription = array(object(value).transcription).map(value => ({ ...object(value) }));
    for (let index = 1; index < transcription.length; index++) repairSegmentBoundary(transcription[index - 1], transcription[index]);
    const output = decodeStrings(value);
    const decoded = array(object(output).transcription);
    for (let index = 0; index < transcription.length; index++) {
        const segment = transcription[index];
        const target = object(decoded[index]);
        if (typeof segment.text === "string") target.text = decodeStrings(segment.text);
        target.tokens = decodeTokens(textTokens(segment));
    }
    return output;
}