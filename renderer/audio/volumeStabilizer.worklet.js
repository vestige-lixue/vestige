// Kept as a standalone JavaScript asset so AudioWorklet loads the same module in
// development and packaged file:// pages, without worker or HMR bootstrap code.
class VolumeStabilizerProcessor extends AudioWorkletProcessor {
    position = 0;
    frame = 0;
    peakHead = 0;
    peakCount = 0;
    power = 0;
    quietFrames = 0;
    seekGainFramesLeft = 0;
    gain = 1;
    limiterGain = 1;

    /** @param {AudioWorkletNodeOptions} options */
    constructor(options) {
        super();
        this.enabled = options.processorOptions.enabled;
        this.mix = this.enabled ? 1 : 0;
        this.lookahead = options.processorOptions.lookaheadFrames;
        this.size = this.lookahead + 1;
        /** @type {Float32Array[]} */
        this.dry = [];
        /** @type {Float32Array[]} */
        this.wet = [];
        /** @type {Float64Array[]} */
        this.weighting = [];
        this.peaks = new Float64Array(this.size);
        this.peakFrames = new Float64Array(this.size);
        this.limiterRelease = 1 - Math.exp(-1 / (sampleRate * 0.08));
        this.mixStep = 1 / (sampleRate * 0.02);
        this.parameters = parameters(options.processorOptions.settings);
        this.port.onmessage = ({ data }) => {
            if (data?.type === "enabled" && typeof data.enabled === "boolean") this.enabled = data.enabled;
            else if (data?.type === "settings") this.parameters = parameters(data.settings);
            else if (data?.type === "reset") {
                this.reset();
                this.seekGainFramesLeft = Math.round(sampleRate * 0.02);
            }
        };
    }

    reset() {
        for (const channel of this.dry) channel.fill(0);
        for (const channel of this.wet) channel.fill(0);
        for (const channel of this.weighting) channel.fill(0);
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
        const { maxGain, gatePower, targetLevel, gainAttack, gainRelease } = this.parameters;
        if (this.dry.length !== output.length) {
            this.dry = Array.from({ length: output.length }, () => new Float32Array(this.size));
            this.wet = Array.from({ length: output.length }, () => new Float32Array(this.size));
            this.weighting = Array.from({ length: output.length }, () => new Float64Array(6));
            this.reset();
        }

        // Playback mixes to the destination's channels before this node. Sum their
        // K-weighted energies instead of selecting the loudest channel per block.
        // The two BS.1770 filters below use the playback context's fixed 48 kHz rate.
        // Filtering is confined to detection; the audible samples retain their spectrum.
        let power = 0;
        let rawPower = 0;
        for (let channel = 0; channel < output.length; channel++) {
            const samples = input?.[channel];
            const state = this.weighting[channel];
            let x1 = state[0], x2 = state[1], y1 = state[2], y2 = state[3], z1 = state[4], z2 = state[5];
            let sum = 0, rawSum = 0;
            for (let i = 0; i < frames; i++) {
                const sample = samples?.[i] ?? 0;
                const value = Number.isFinite(sample) ? sample : 0;
                const shelf = 1.53512485958697 * value - 2.69169618940638 * x1 + 1.19839281085285 * x2
                    + 1.69065929318241 * y1 - 0.73248077421585 * y2;
                const weighted = shelf - 2 * y1 + y2 + 1.99004745483398 * z1 - 0.99007225036621 * z2;
                x2 = x1; x1 = value;
                y2 = y1; y1 = shelf;
                z2 = z1; z1 = weighted;
                sum += weighted * weighted;
                rawSum += value * value;
            }
            state[0] = x1; state[1] = x2; state[2] = y1; state[3] = y2; state[4] = z1; state[5] = z2;
            power += sum / frames;
            rawPower = Math.max(rawPower, rawSum / frames);
        }
        // BS.1770's -0.691 dB calibration. The existing envelope remains an
        // adaptive estimate, not a gated integrated or fixed-window LUFS meter.
        power *= 10 ** (-0.691 / 10);
        const levelTime = power > this.power ? 0.03 : 0.2;
        const levelBlend = 1 - Math.exp(-frames / (sampleRate * levelTime));
        let targetGain = this.gain;
        // Keep the quiet threshold in unweighted dBFS, independent of the new
        // loudness estimate. It controls amplification, not noise removal.
        if (rawPower >= gatePower) {
            // A seek can land in silence or partway through an onset. Use the
            // loudest of the first 20 ms above the gate to acquire attenuation.
            if (this.seekGainFramesLeft > 0) this.power = Math.max(this.power, power);
            else if (this.power === 0 || this.quietFrames > sampleRate * 0.25) this.power = power;
            else this.power += (power - this.power) * levelBlend;
            this.quietFrames = 0;
            targetGain = Math.max(0.0630957, Math.min(maxGain, targetLevel / Math.sqrt(this.power)));
            if (this.seekGainFramesLeft > 0) {
                this.gain = Math.min(this.gain, targetGain);
                this.seekGainFramesLeft = Math.max(0, this.seekGainFramesLeft - frames);
            }
        }
        else {
            this.quietFrames += frames;
            this.power += (power - this.power) * levelBlend;
            if (this.quietFrames > sampleRate * 0.25) targetGain = Math.min(this.gain, 1);
        }
        const gainBlend = targetGain < this.gain ? gainAttack : gainRelease;
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

/** @param {import("../../shared/settings/Settings").VolumeStabilizationSettings} settings */
function parameters(settings) {
    return {
        maxGain: 10 ** (settings.maxGainDb / 20),
        gatePower: 10 ** (settings.gateThresholdDb / 10),
        targetLevel: 10 ** (settings.targetLevelDb / 20),
        gainAttack: 1 - Math.exp(-1 / (sampleRate * settings.gainAttackMs / 1000)),
        gainRelease: 1 - Math.exp(-1 / (sampleRate * settings.gainReleaseMs / 1000))
    };
}

registerProcessor("vestige-volume-stabilizer", VolumeStabilizerProcessor);
export {};