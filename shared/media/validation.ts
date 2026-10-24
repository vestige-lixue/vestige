export const validationInitialConcurrency = 2;
export const validationMaxConcurrency = 6;
export const validationSampleMs = 1000;
export const validationCooldownWindows = 2;
export const validationThroughputThreshold = 0.1;
export const validationLatencyLimitMs = 50;

export type MediaValidationLoad = {
    bytesRead: number;
    sampledAt: number;
    eventLoopDelayMs: number;
    logicalProcessors: number;
};