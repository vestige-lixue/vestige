declare class AudioWorkletProcessor {
    readonly port: MessagePort;
}

declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, processor: new (options: AudioWorkletNodeOptions) => AudioWorkletProcessor): void;