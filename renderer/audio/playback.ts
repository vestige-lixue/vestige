import processorURL from "./volumeStabilizer.worklet.js?url&no-inline";

export type PlaybackAudio = {
    resume(): Promise<void>;
    pause(): void;
    setVolume(volume: number): void;
    setEnabled(enabled: boolean): void;
    reset(): void;
    dispose(): void;
};

export function createPlaybackAudio(element: HTMLMediaElement, volume: number, enabled: boolean, onFailure: (error: unknown) => void): PlaybackAudio {
    const context = new AudioContext({ latencyHint: "interactive" });
    const master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);
    let source: MediaElementAudioSourceNode;
    try {
        source = context.createMediaElementSource(element);
    }
    catch (error) {
        void context.close();
        throw error;
    }
    source.connect(master);
    element.volume = 1;
    let processor: AudioWorkletNode | null = null;
    let disposed = false;
    let playing = false;
    let failed = false;
    void context.suspend().catch(console.error);

    function fail(error: unknown): void {
        if (disposed || failed) return;
        failed = true;
        source.disconnect();
        processor?.disconnect();
        processor?.port.close();
        processor = null;
        source.connect(master);
        onFailure(error);
    }

    const initialized = context.audioWorklet.addModule(processorURL).then(() => {
        if (disposed) return;
        processor = new AudioWorkletNode(context, "vestige-volume-stabilizer", { processorOptions: { enabled } });
        processor.onprocessorerror = () => fail(new Error("稳定音量处理器运行失败。"));
        source.disconnect();
        source.connect(processor).connect(master);
    }).catch(fail);

    const reset = (): void => processor?.port.postMessage({ type: "reset" });
    element.addEventListener("seeking", reset);
    element.addEventListener("seeked", reset);

    return {
        async resume(): Promise<void> {
            playing = true;
            await initialized;
            if (!disposed && playing && context.state !== "running") await context.resume();
        },
        pause(): void {
            playing = false;
            if (!disposed) void context.suspend().catch(console.error);
        },
        setVolume(volume: number): void {
            if (disposed) return;
            const time = context.currentTime;
            master.gain.cancelAndHoldAtTime(time);
            master.gain.setTargetAtTime(volume, time, 0.015);
        },
        setEnabled(value: boolean): void {
            enabled = value;
            if (failed && enabled) onFailure(new Error("稳定音量处理器不可用。"));
            else processor?.port.postMessage({ type: "enabled", enabled });
        },
        reset,
        dispose(): void {
            if (disposed) return;
            disposed = true;
            playing = false;
            element.removeEventListener("seeking", reset);
            element.removeEventListener("seeked", reset);
            source.disconnect();
            processor?.disconnect();
            processor?.port.close();
            master.disconnect();
            void context.close().catch(console.error);
        }
    };
}