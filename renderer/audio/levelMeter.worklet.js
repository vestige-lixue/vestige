// A silent analysis branch reads all three taps without changing playback samples.
class LevelMeterProcessor extends AudioWorkletProcessor {
    generation = 0;
    frames = 0;
    sourceWarmup = 0;
    interval = Math.round(sampleRate / 30);
    /** @type {number[][]} */
    peaks = [[], [], []];
    /** @type {number[][]} */
    clips = [[], [], []];

    constructor() {
        super();
        this.port.onmessage = ({ data }) => {
            if (data?.type !== "reset") return;
            this.generation = data.generation;
            this.sourceWarmup = data.sourceWarmup ?? this.sourceWarmup;
            this.reset();
        };
    }

    reset() {
        this.frames = 0;
        for (const stage of this.peaks) stage.fill(0);
        for (const stage of this.clips) stage.fill(-1);
    }

    /** @param {Float32Array[][]} inputs @param {Float32Array[][]} outputs */
    process(inputs, outputs) {
        const frames = outputs[0]?.[0]?.length ?? 0;
        if (!frames) return true;
        for (const output of outputs[0]) output.fill(0);
        if (this.peaks.some((stage, index) => stage.length !== (inputs[index]?.length ?? 0))) {
            this.peaks = Array.from({ length: 3 }, (_, index) => Array(inputs[index]?.length ?? 0).fill(0));
            this.clips = this.peaks.map(stage => stage.map(() => -1));
            this.frames = 0;
        }
        for (let stage = 0; stage < 3; stage++) {
            for (let channel = 0; channel < this.peaks[stage].length; channel++) {
                const samples = inputs[stage][channel];
                for (let frame = 0; frame < frames; frame++) {
                    if (stage === 0 && frame < this.sourceWarmup) continue;
                    const peak = Number.isFinite(samples[frame]) ? Math.abs(samples[frame]) : 0;
                    this.peaks[stage][channel] = Math.max(this.peaks[stage][channel], peak);
                    if (peak >= 1) this.clips[stage][channel] = this.frames + frame;
                }
            }
        }
        this.sourceWarmup = Math.max(0, this.sourceWarmup - frames);
        this.frames += frames;
        if (this.frames >= this.interval) {
            /** @type {import("./levels").LevelMessage} */
            const message = {
                generation: this.generation,
                time: currentTime + frames / sampleRate,
                peaks: this.peaks,
                clipAges: this.clips.map(stage => stage.map(frame => frame < 0 ? -1 : (this.frames - frame - 1) / sampleRate * 1000))
            };
            this.port.postMessage(message);
            this.reset();
        }
        return true;
    }
}

registerProcessor("vestige-level-meter", LevelMeterProcessor);
export {};