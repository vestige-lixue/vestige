import { copyFile, open } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { type Range } from "../../../shared/util/range";
import { type AbsolutePath } from "../../../shared/util/path";
import { parseAbsolutePath } from "../../util/file";
import { runProcess } from "../../util/process";
import { type ExecutionContext } from "../execute";
import { type WaveInfo, waveInfo, writeWaveSlice } from "../audio";

export type AudioPart = Range & { filename: AbsolutePath };
export const maximumPartDuration = 20;

export function speechRanges(diagnostic: string, duration: number): Range[] {
    const result: Range[] = [];
    for (const line of diagnostic.split(/\r?\n/)) {
        const match = /^\s*(\d+(?:\.\d+)?)\s+--\s+(\d+(?:\.\d+)?)\s*$/.exec(line);
        if (!match) continue;
        const start = Math.max(0, Number(match[1])), end = Math.min(duration, Number(match[2]));
        if (end > start) result.push({ start, end });
    }
    return result.sort((a, b) => a.start - b.start);
}

async function detectSpeech(context: ExecutionContext): Promise<Range[]> {
    const { audio, directory, backend, runtimeDirectory, signal, feedback, duration } = context;
    const executable = parseAbsolutePath(join(dirname(backend.executable), `sherpa-onnx-vad${process.platform === "win32" ? ".exe" : ""}`));
    try {
        signal?.throwIfAborted();
        // Keep non-ASCII application paths out of the native model argument.
        await copyFile(join(runtimeDirectory, "..", "vad", "silero_vad.onnx"), join(directory, "vad.onnx"));
        const args = ["--silero-vad-model=vad.onnx", "--vad-provider=cpu", "--vad-num-threads=1",
            "--silero-vad-min-silence-duration=0.3", "--silero-vad-max-speech-duration=20", basename(audio), "vad-speech.wav"];
        feedback?.record?.("Sherpa VAD command", { executable, args, directory });
        const output = await runProcess(executable, args, directory, signal, feedback?.output);
        return speechRanges(output.stderr, duration);
    }
    catch (error) {
        signal?.throwIfAborted();
        // Custom/older backends may lack the VAD CLI. All audio is still decoded
        // in bounded windows; VAD is a boundary hint, never a discard filter.
        feedback?.record?.("Sherpa VAD unavailable", error);
        feedback?.output("stderr", "[sherpa-onnx] VAD unavailable; using bounded audio windows.\n");
        return [];
    }
}

export function pauseBoundaries(speech: Range[]): number[] {
    const result: number[] = [];
    let previousEnd = 0;
    for (const { start, end } of speech) {
        if (start - previousEnd >= 0.08) result.push((previousEnd + start) / 2);
        previousEnd = Math.max(previousEnd, end);
    }
    return result;
}

export async function splitAudioPart(part: AudioPart, signal?: AbortSignal): Promise<AudioPart[]> {
    const info = await waveInfo(part.filename);
    const middle = Math.round(info.dataLength / info.blockAlign / 2) / info.sampleRate;
    const left = parseAbsolutePath(part.filename.replace(/\.wav$/, "-0.wav"));
    const right = parseAbsolutePath(part.filename.replace(/\.wav$/, "-1.wav"));
    await writeWaveSlice(part.filename, left, info, 0, middle, signal);
    await writeWaveSlice(part.filename, right, info, middle, info.duration, signal);
    return [
        { filename: left, start: part.start, end: part.start + middle },
        { filename: right, start: part.start + middle, end: part.end }
    ];
}

async function quietBoundary(audio: AbsolutePath, info: WaveInfo, end: number, signal?: AbortSignal): Promise<number> {
    signal?.throwIfAborted();
    const startSample = Math.max(0, Math.round((end - 2) * info.sampleRate));
    const endSample = Math.round(end * info.sampleRate);
    const samples = Buffer.alloc((endSample - startSample) * 2);
    const input = await open(audio, "r");
    try {
        const { bytesRead } = await input.read(samples, 0, samples.length, info.dataOffset + startSample * 2);
        const window = 640; // 40 ms at 16 kHz, with 20 ms steps.
        let bestEnergy = Infinity, cut = end;
        for (let offset = 0; offset + window <= bytesRead / 2; offset += window / 2) {
            let energy = 0;
            for (let i = 0; i < window; i++) energy += samples.readInt16LE((offset + i) * 2) ** 2;
            if (energy <= bestEnergy) {
                bestEnergy = energy;
                cut = (startSample + offset + window / 2) / info.sampleRate;
            }
        }
        return cut;
    }
    finally {
        await input.close();
    }
}

export async function prepareAudioParts(context: ExecutionContext): Promise<AudioPart[]> {
    const { audio, directory, duration, signal, feedback } = context;
    if (duration <= maximumPartDuration) return [{ filename: audio, start: 0, end: duration }];
    const info = await waveInfo(audio);
    const speech = await detectSpeech(context);
    const pauses = pauseBoundaries(speech);
    const parts: AudioPart[] = [];
    for (let start = 0; start < duration;) {
        signal?.throwIfAborted();
        const remaining = duration - start;
        let end = duration;
        if (remaining > maximumPartDuration) {
            // Avoid a very short final window. VAD cannot enforce a hard length
            // cap by itself, so bound every slice independently of its output.
            const target = start + (remaining < maximumPartDuration + 6 ? remaining / 2 : maximumPartDuration);
            const pause = pauses.findLast(point => point >= start + 6 && point <= target);
            end = pause ?? await quietBoundary(audio, info, target, signal);
        }
        end = Math.min(duration, Math.round(end * info.sampleRate) / info.sampleRate);
        const filename = parseAbsolutePath(join(directory, `part-${parts.length.toString().padStart(6, "0")}.wav`));
        await writeWaveSlice(audio, filename, info, start, end, signal);
        parts.push({ filename, start, end });
        start = end;
    }
    feedback?.record?.("Sherpa audio parts", { speech, parts });
    feedback?.output("stderr", `[sherpa-onnx] Prepared ${parts.length} audio parts, each at most ${maximumPartDuration} seconds.\n`);
    return parts;
}