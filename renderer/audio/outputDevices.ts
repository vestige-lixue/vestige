// Undefined means the browser did not expose a unique default output; null means no outputs.
function defaultOutput(devices: MediaDeviceInfo[]): string | null | undefined {
    const outputs = devices.filter(device => device.kind === "audiooutput");
    if (outputs.length === 0) return null;
    const selected = outputs.find(device => device.deviceId === "default");
    if (!selected?.groupId) return undefined;
    const matches = outputs.filter(device => device.deviceId && device.deviceId !== "default"
        && device.deviceId !== "communications" && device.groupId === selected.groupId);
    return matches.length === 1 ? matches[0]?.deviceId : undefined;
}

export function watchDefaultOutput(onChanged: () => void): () => void {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return () => {};
    let previous: string | null | undefined;
    let disposed = false;
    let reading = false;
    let requested = 0;
    let reported = false;

    async function refresh(): Promise<void> {
        requested++;
        if (reading) return;
        reading = true;
        try {
            let current: number;
            do {
                current = requested;
                let devices: MediaDeviceInfo[];
                try {
                    devices = await mediaDevices.enumerateDevices();
                }
                catch (error) {
                    if (!disposed && !reported) console.warn("Could not inspect the default audio output device.", error);
                    reported = true;
                    continue;
                }
                if (disposed) return;
                if (current !== requested) continue;
                const next = defaultOutput(devices);
                if (next === undefined && !reported) {
                    console.warn("The browser did not expose a unique default audio output device; automatic output-change pause is unavailable.");
                }
                reported = next === undefined;
                const removed = typeof previous === "string" && devices.some(device => device.kind === "audiooutput" && device.deviceId && device.deviceId !== "default" && device.deviceId !== "communications")
                    && !devices.some(device => device.kind === "audiooutput" && device.deviceId === previous);
                const changed = removed || (previous !== undefined && next !== undefined && previous !== next);
                previous = next;
                if (changed) onChanged();
            } while (current !== requested);
        }
        finally {
            reading = false;
        }
    }

    const changed = (): void => {
        void refresh();
    };
    const visible = (): void => {
        if (document.visibilityState === "visible") changed();
    };
    mediaDevices.addEventListener("devicechange", changed);
    document.addEventListener("visibilitychange", visible);
    changed();
    return () => {
        disposed = true;
        mediaDevices.removeEventListener("devicechange", changed);
        document.removeEventListener("visibilitychange", visible);
    };
}