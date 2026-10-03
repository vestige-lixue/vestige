<div class="controls">
    <button type="button" {disabled} onclick={togglePlaying}>
        {playerState.playing ? "暂停" : "播放"}
    </button>
    <Slider.Root
        class="progress"
        type="single"
        min={0}
        max={progressSteps}
        step={1}
        {disabled}
        bind:value={() => progress, seek}
    >
        <span class="track">
            <Slider.Range class="progress-range" />
        </span>
        <Slider.Thumb index={0} class="progress-thumb" />
    </Slider.Root>
    <span class="time">{formatTime(playerState.currentTime)} / {formatTime(duration)}</span>
</div>


<style>
    .controls {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 12px;
    }
    .controls button {
        padding: 4px 12px;
    }
    .controls button:disabled {
        opacity: 0.5;
    }
    .controls :global(.progress) {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        height: 20px;
        cursor: pointer;
    }
    .controls :global(.progress[data-disabled]) {
        cursor: default;
        opacity: 0.5;
    }
    .track {
        position: relative;
        width: 100%;
        height: 4px;
        border-radius: 2px;
        background: var(--c-border);
    }
    .controls :global(.progress-range) {
        position: absolute;
        height: 100%;
        border-radius: inherit;
        background: var(--c-text);
    }
    .controls :global(.progress-thumb) {
        display: block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--c-text);
    }
    .controls :global(.progress-thumb:focus-visible) {
        outline: 2px solid var(--c-text);
        outline-offset: 3px;
    }
    .time {
        white-space: nowrap;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--c-muted);
    }
</style>


<script lang="ts">
    import { Slider } from "bits-ui";
    import { mediaImports } from "../../states/media.svelte";
    import { playerState, setCurrentTime, togglePlaying } from "../../states/player.svelte";

    // Keep the slider's step rounding from writing back to the precise playback time.
    const progressSteps = 1000;
    const duration = $derived(mediaImports.selected?.vestige?.media.duration ?? 0);
    const disabled = $derived(!playerState.media || !Number.isFinite(duration) || duration <= 0);
    const progress = $derived(disabled || !Number.isFinite(playerState.currentTime)
        ? 0
        : Math.round(Math.min(1, Math.max(0, playerState.currentTime / duration)) * progressSteps));

    function seek(progress: number): void {
        if (disabled) return;
        setCurrentTime(progress / progressSteps * duration);
    }

    function formatTime(time: number): string {
        const seconds = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
        const minutes = Math.floor(seconds / 60);
        const remainder = String(seconds % 60).padStart(2, "0");
        if (minutes < 60) return `${String(minutes).padStart(2, "0")}:${remainder}`;
        return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}`;
    }
</script>