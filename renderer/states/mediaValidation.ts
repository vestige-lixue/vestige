import {
    validationInitialConcurrency, validationMaxConcurrency, validationCooldownWindows,
    validationThroughputThreshold, validationLatencyLimitMs, type MediaValidationLoad
} from "../../shared/media/validation";

export class MediaValidationConcurrency {
    private maximum: number;
    private limit: number;
    private playing = false;
    private previous: MediaValidationLoad | null = null;
    private throughput: number | null = null;
    private cooldown = 0;

    constructor(logicalProcessors: number) {
        this.maximum = Math.max(1, Math.min(validationMaxConcurrency, logicalProcessors));
        this.limit = Math.min(validationInitialConcurrency, this.maximum);
    }

    getBytesPerSecond(): number | null {
        return this.throughput === null ? null : this.throughput * 1000;
    }

    getConcurrency(): number {
        return this.playing ? 1 : this.limit;
    }

    setPlaying(value: boolean): void {
        if (this.playing === value) return;
        this.playing = value;
        this.previous = null;
        this.throughput = null;
        this.cooldown = validationCooldownWindows;
    }

    observe(sample: MediaValidationLoad, roundTripMs: number): void {
        this.maximum = Math.max(1, Math.min(validationMaxConcurrency, sample.logicalProcessors));
        this.limit = Math.min(this.limit, this.maximum);
        const elapsed = this.previous ? sample.sampledAt - this.previous.sampledAt : 0;
        const rate = this.previous && elapsed > 0 ? (sample.bytesRead - this.previous.bytesRead) / elapsed : null;
        this.previous = sample;
        const previousRate = this.throughput;
        this.throughput = rate;
        // Observe both main-loop delay and IPC responsiveness; either can signal contention.
        if (sample.eventLoopDelayMs > validationLatencyLimitMs || roundTripMs > validationLatencyLimitMs) {
            this.limit = Math.max(1, this.limit - 1);
            this.cooldown = validationCooldownWindows;
            return;
        }
        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }
        if (this.playing || rate === null || previousRate === null || previousRate <= 0 || rate < 0) return;
        const change = (rate - previousRate) / previousRate;
        if (change >= validationThroughputThreshold && this.limit < this.maximum) this.limit++;
        else if (change <= -validationThroughputThreshold && this.limit > 1) this.limit--;
        else return;
        this.cooldown = validationCooldownWindows;
    }
}