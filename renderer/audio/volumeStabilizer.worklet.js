// Kept as a standalone JavaScript asset so AudioWorklet loads the same module in
// development and packaged file:// pages, without worker or HMR bootstrap code.
class VolumeStabilizerProcessor extends AudioWorkletProcessor {
    position = 0;
    frame = 0;
    peakHead = 0;
    peakCount = 0;
    power = 0;
    quietFrames = 0;
    gain = 1;
    limiterGain = 1;

    /** @param {AudioWorkletNodeOptions} options */
    constructor(options) {
        super();
        this.enabled = Boolean(options.processorOptions?.enabled);
        this.mix = this.enabled ? 1 : 0;
        this.lookahead = Math.max(1, Math.round(sampleRate * 0.005));
        this.size = this.lookahead + 1;
        /** @type {Float32Array[]} */
        this.dry = [];
        /** @type {Float32Array[]} */
        this.wet = [];
        this.peaks = new Float64Array(this.size);
        this.peakFrames = new Float64Array(this.size);
        this.gainAttack = 1 - Math.exp(-1 / (sampleRate * 0.025));
        this.gainRelease = 1 - Math.exp(-1 / (sampleRate * 0.8));
        this.limiterRelease = 1 - Math.exp(-1 / (sampleRate * 0.08));
        this.mixStep = 1 / (sampleRate * 0.02);
        this.port.onmessage = ({ data }) => {
            if (data?.type === "enabled" && typeof data.enabled === "boolean") this.enabled = data.enabled;
            else if (data?.type === "reset") this.reset();
        };
    }

    reset() {
        for (const channel of this.dry) channel.fill(0);
        for (const channel of this.wet) channel.fill(0);
        this.position = 0;
        this.frame = 0;
        this.peakHead = 0;
        this.peakCount = 0;
        this.power = 0;
        this.quietFrames = 0;
        this.gain = 1;
        this.limiterGain = 1;
    }

    /** @param {Float32Array[][]} inputs @param {Float32Array[][]} outputs */
    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        const frames = output?.[0]?.length ?? 0;
        if (!frames) return true;
        if (this.dry.length !== output.length) {
            this.dry = Array.from({ length: output.length }, () => new Float32Array(this.size));
            this.wet = Array.from({ length: output.length }, () => new Float32Array(this.size));
            this.reset();
        }

        // Link channels with the loudest channel's RMS, preserving stereo balance
        // and avoiding a boost when one channel contains silence.
        let power = 0;
        for (const channel of input ?? []) {
            let sum = 0;
            for (let i = 0; i < frames; i++) {
                const value = Number.isFinite(channel[i]) ? channel[i] : 0;
                sum += value * value;
            }
            power = Math.max(power, sum / frames);
        }
        const levelTime = power > this.power ? 0.03 : 0.2;
        const levelBlend = 1 - Math.exp(-frames / (sampleRate * levelTime));
        let targetGain = this.gain;
        // -50 dBFS is a level gate, not a noise-removal or speech-recognition step.
        if (power >= 0.00001) {
            this.power = this.power === 0 || this.quietFrames > sampleRate * 0.25
                ? power : this.power + (power - this.power) * levelBlend;
            this.quietFrames = 0;
            // Target -20 dBFS RMS with at most +18 dB of amplification.
            targetGain = Math.max(0.0630957, Math.min(7.9432823, 0.1 / Math.sqrt(this.power)));
        }
        else {
            this.quietFrames += frames;
            this.power += (power - this.power) * levelBlend;
            if (this.quietFrames > sampleRate * 0.25) targetGain = Math.min(this.gain, 1);
        }
        const gainBlend = targetGain < this.gain ? this.gainAttack : this.gainRelease;
        for (let i = 0; i < frames; i++) {
            this.gain += (targetGain - this.gain) * gainBlend;
            let peak = 0;
            for (let channel = 0; channel < output.length; channel++) {
                const value = input?.[channel]?.[i] ?? 0;
                const finite = Number.isFinite(value) ? value : 0;
                this.dry[channel][this.position] = finite;
                this.wet[channel][this.position] = finite * this.gain;
                peak = Math.max(peak, Math.abs(this.wet[channel][this.position]));
            }
            // A monotonic queue finds the peak across the lookahead window in
            // amortized constant time, with no allocation per render quantum.
            while (this.peakCount && this.peakFrames[this.peakHead] < this.frame - this.lookahead) {
                this.peakHead = (this.peakHead + 1) % this.size;
                this.peakCount--;
            }
            while (this.peakCount && this.peaks[(this.peakHead + this.peakCount - 1) % this.size] <= peak) this.peakCount--;
            const tail = (this.peakHead + this.peakCount) % this.size;
            this.peaks[tail] = peak;
            this.peakFrames[tail] = this.frame++;
            this.peakCount++;
            // Linked sample-peak limiting at -1 dBFS; this is not true-peak metering.
            const ceilingGain = Math.min(1, 0.8912509 / Math.max(this.peaks[this.peakHead], 1e-12));
            this.limiterGain = ceilingGain < this.limiterGain
                ? ceilingGain : this.limiterGain + (ceilingGain - this.limiterGain) * this.limiterRelease;
            this.mix = this.enabled ? Math.min(1, this.mix + this.mixStep) : Math.max(0, this.mix - this.mixStep);
            const read = (this.position + 1) % this.size;
            for (let channel = 0; channel < output.length; channel++) {
                const dry = this.dry[channel][read];
                const wet = this.wet[channel][read] * this.limiterGain;
                output[channel][i] = dry + (wet - dry) * this.mix;
            }
            this.position = read;
        }
        // Chromium may otherwise retire a paused processor before playback resumes.
        return true;
    }
}

registerProcessor("vestige-volume-stabilizer", VolumeStabilizerProcessor);
export {};