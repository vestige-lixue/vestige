import { runCommand } from "./commands";
import * as player from "./player.svelte";

export function mount(): () => void {
    if (!("mediaSession" in navigator)) return () => {};
    const session = navigator.mediaSession;
    return $effect.root(() => {
        $effect(() => {
            const available = player.getURL() !== null;
            session.setActionHandler("play", available ? () => runCommand({ kind: "playSelectedMedia", playing: true }) : null);
            session.setActionHandler("pause", available ? () => runCommand({ kind: "playSelectedMedia", playing: false }) : null);
            session.setActionHandler("previoustrack", available ? () => runCommand({ kind: "jumpSelectedMedia", direction: -1 }) : null);
            session.setActionHandler("nexttrack", available ? () => runCommand({ kind: "jumpSelectedMedia", direction: 1 }) : null);
            return () => {
                session.setActionHandler("play", null);
                session.setActionHandler("pause", null);
                session.setActionHandler("previoustrack", null);
                session.setActionHandler("nexttrack", null);
            };
        });
        $effect(() => {
            session.playbackState = player.getURL() === null ? "none" : player.isPlaying() ? "playing" : "paused";
        });
        return () => {
            session.playbackState = "none";
        };
    });
}