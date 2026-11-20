import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultSettings } from "../shared/settings/defaults";

const rate = 48000;
const blockSize = 128;
const lookahead = 240;
const source = readFileSync(new URL("../renderer/audio/volumeStabilizer.worklet.js", import.meta.url), "utf8")
    .replace(/export\s*\{\s*\};?\s*$/, "");

type Processor = {
    power: number;
    quietFrames: number;
    gain: number;
    port: { onmessage(event: { data: { type: "reset" } }): void };
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
    reset(): void;
};

function create(enabled = true): Processor {
    const registered: { processor?: new (options: unknown) => Processor } = {};
    // Execute the shipped asset, with only the AudioWorklet host globals replaced.
    const register = new Function("AudioWorkletProcessor", "sampleRate", "registerProcessor", source);
    register(class {
        port = { onmessage: null };
    }, rate, (name: string, processor: NonNullable<typeof registered.processor>) => {
        expect(name).toBe("vestige-volume-stabilizer");
        registered.processor = processor;
    });
    if (!registered.processor) throw new Error("The audio processor was not registered.");
    return new registered.processor({ processorOptions: { enabled, lookaheadFrames: lookahead, settings: defaultSettings.volumeStabilization } });
}

function render(processor: Processor, input: Float32Array[]): Float32Array[] {
    const length = input[0].length;
    const block = input.map(() => new Float32Array(blockSize));
    const output = input.map(() => new Float32Array(blockSize));
    const result = input.map(() => new Float32Array(length));
    for (let start = 0; start < length + lookahead; start += blockSize) {
        for (let channel = 0; channel < input.length; channel++) {
            block[channel].fill(0);
            block[channel].set(input[channel].subarray(start, start + blockSize));
        }
        processor.process([block], [output]);
        for (let i = 0; i < blockSize; i++) {
            const frame = start + i - lookahead;
            if (frame >= 0 && frame < length) for (let channel = 0; channel < input.length; channel++) result[channel][frame] = output[channel][i];
        }
    }
    return result;
}

function tone(frequency: number, amplitude = Math.SQRT2 * 0.1, seconds = 2): Float32Array {
    return Float32Array.from({ length: rate * seconds }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / rate));
}

function levelDb(samples: Float32Array): number {
    return 10 * Math.log10(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
}

function measuredPower(channels: Float32Array[]): number {
    const processor = create();
    const output = channels.map(() => new Float32Array(blockSize));
    let sum = 0, blocks = 0;
    for (let start = 0; start + blockSize <= channels[0].length; start += blockSize) {
        // Inspect each block's detector energy without the unchanged asymmetric
        // envelope. Filter history remains continuous across blocks.
        processor.power = 0;
        processor.process([channels.map(channel => channel.subarray(start, start + blockSize))], [output]);
        if (start >= rate) {
            sum += processor.power;
            blocks++;
        }
    }
    return sum / blocks;
}

describe("volume stabilization measurement", () => {
    // Independent references: FFmpeg ebur128, 48 kHz stereo tones at -20 dBFS RMS
    // per channel. These validate filter calibration, frequency response and sum.
    it.each([[100, -18.8], [997, -17.0], [10000, -13.6]])("matches the reference loudness at %i Hz", (frequency, expected) => {
        const samples = tone(frequency);
        expect(Math.abs(10 * Math.log10(measuredPower([samples, samples])) - expected)).toBeLessThan(0.08);
    });

    it("depends on total channel energy rather than the loudest channel", () => {
        const samples = tone(997);
        const silent = new Float32Array(samples.length);
        const single = measuredPower([samples, silent]);
        expect(measuredPower([silent, samples])).toBeCloseTo(single, 10);
        expect(measuredPower([samples, samples]) / single).toBeCloseTo(2, 6);
        expect(measuredPower([samples.map(value => value * Math.SQRT2), silent]) / single).toBeCloseTo(2, 6);
        expect(measuredPower([samples, samples.map(value => -value)]) / single).toBeCloseTo(2, 6);
    });

    it("keeps the quiet threshold in raw dBFS for low-frequency content", () => {
        const processor = create();
        // -40 dBFS DC is above the -50 dBFS gate, although K weighting rejects it.
        render(processor, [new Float32Array(rate).fill(0.01), new Float32Array(rate).fill(0.01)]);
        expect(processor.quietFrames).toBeLessThanOrEqual(lookahead + blockSize);
        expect(processor.gain).toBeGreaterThan(1);
    });

    it("resets filter history on seek and channel layout changes", () => {
        const processor = create();
        const samples = tone(100);
        render(processor, [samples, samples]);
        processor.reset();
        const silent = [new Float32Array(1024), new Float32Array(1024)];
        expect(render(processor, silent)).toEqual(render(create(), silent));
        render(processor, [samples]);
        expect(render(processor, silent)).toEqual(render(create(), silent));
    });

    it("starts repeated loud previews at their stabilized level", () => {
        const processor = create();
        const loud = tone(1000, 0.8);
        const [continuous] = render(processor, [loud, loud]);
        const window = rate * 0.01;
        const reference = levelDb(continuous.subarray(-window));
        const preview = loud.subarray(0, rate * 0.08);
        for (let i = 0; i < 4; i++) {
            processor.port.onmessage({ data: { type: "reset" } });
            const [output] = render(processor, [preview, preview]);
            expect(Math.abs(levelDb(output.subarray(0, window)) - reference)).toBeLessThan(1);
        }
    });

    it("acquires a loud onset after seeking from boosted audio into background noise", () => {
        const processor = create();
        const quiet = tone(1000, 0.01);
        render(processor, [quiet, quiet]);
        expect(processor.gain).toBeGreaterThan(5);
        processor.port.onmessage({ data: { type: "reset" } });
        const loud = tone(1000, 0.8);
        const lead = blockSize * 30 + 73;
        const ramp = rate * 0.005;
        const samples = new Float32Array(lead + loud.length).fill(0.0005);
        samples.set(loud.map((value, i) => value * Math.min(1, i / ramp)), lead);
        const [output] = render(processor, [samples, samples]);
        const window = rate * 0.01;
        expect(Math.abs(levelDb(output.subarray(lead + ramp, lead + ramp + window)) - levelDb(output.subarray(-window)))).toBeLessThan(1);
    });

    it("raises gain gradually when a seek lands on quiet audio", () => {
        const processor = create();
        const loud = tone(1000, 0.8);
        render(processor, [loud, loud]);
        processor.port.onmessage({ data: { type: "reset" } });
        const quiet = tone(1000, 0.01);
        const [output] = render(processor, [quiet, quiet]);
        const window = rate * 0.01;
        expect(levelDb(output.subarray(0, window)) - levelDb(quiet.subarray(0, window))).toBeLessThan(1);
        expect(levelDb(output.subarray(-window)) - levelDb(quiet.subarray(-window))).toBeGreaterThan(15);
    });

    it("does not apply weighting filters to the audible bypass path", () => {
        const samples = tone(100);
        expect(render(create(false), [samples, samples])).toEqual([samples, samples]);
    });

    it("keeps linked sample limiting and finite output with transients and invalid samples", () => {
        const samples = tone(997, 2, 1);
        samples[319] = 20;
        samples[321] = NaN;
        samples[550] = Infinity;
        samples[551] = -Infinity;
        const output = render(create(), [samples, samples.map(value => value * 0.25)]);
        let peak = 0, balanceError = 0, finite = true;
        for (let i = 0; i < samples.length; i++) {
            peak = Math.max(peak, Math.abs(output[0][i]), Math.abs(output[1][i]));
            balanceError = Math.max(balanceError, Math.abs(output[1][i] - output[0][i] * 0.25));
            finite &&= Number.isFinite(output[0][i]) && Number.isFinite(output[1][i]);
        }
        expect(finite).toBe(true);
        expect(peak).toBeLessThanOrEqual(0.891251);
        expect(balanceError).toBeLessThan(1e-7);
    });
});