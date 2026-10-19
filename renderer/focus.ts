export type FocusTarget = "playback-progress" | "playback-speed" | "playback-volume";

const handlers = new Map<FocusTarget, () => void>();

export function register(target: FocusTarget, handler: () => void): () => void {
    handlers.set(target, handler);
    return () => {
        if (handlers.get(target) === handler) handlers.delete(target);
    };
}

export function focus(target: FocusTarget): void {
    handlers.get(target)?.();
}