<div class="levels">
    {#each Array(channelCount).keys() as channel (channel)}
        {@const value = displayed[channel]}
        <div class="level-row">
            <span class="channel">{channelCount === 1 ? "M" : channelCount === 2 ? ["L", "R"][channel] : channel + 1}</span>
            <div class="level-meter">
                <div class="level-track">
                    <span class="level-fill max" style:width={`${value?.widths[0] ?? 0}%`}></span>
                    <span class="level-fill mid" style:width={`${value?.widths[1] ?? 0}%`}></span>
                    <span class="level-fill min" style:width={`${value?.widths[2] ?? 0}%`}></span>
                </div>
                <span class="level-clip" class:active={value?.clipped ?? false}></span>
            </div>
            <span class="level-number">{levelText(value?.peak ?? 0)}</span>
        </div>
    {/each}
</div>


<style>
    .levels {
        display: grid;
        gap: 5px;
        margin-top: 4px;
    }
    .level-row {
        display: grid;
        grid-template-columns: 14px minmax(0, 1fr) 45px;
        align-items: center;
        gap: 8px;
        min-height: 18px;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }
    .channel {
        color: var(--c-text-80p);
    }
    .level-meter {
        display: flex;
        min-width: 0;
        height: 7px;
    }
    .level-track {
        position: relative;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        border-radius: 2px 0 0 2px;
        background: color-mix(in srgb, var(--c-text) 6%, var(--c-background));
        isolation: isolate;
    }
    .level-fill {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: inherit;
    }
    .level-fill.max {
        background: color-mix(in srgb, var(--c-audio-level) 40%, var(--c-background));
    }
    .level-fill.mid {
        background: color-mix(in srgb, var(--c-audio-level) 70%, var(--c-background));
    }
    .level-fill.min {
        background: var(--c-audio-level);
    }
    .level-clip.active {
        background: var(--c-audio-level);
    }
    .level-clip {
        flex: 0 0 7px;
        border-radius: 0 2px 2px 0;
        background: color-mix(in srgb, var(--c-text) 25%, var(--c-background));
    }
    .level-number {
        color: var(--c-audio-level);
        text-align: right;
        white-space: nowrap;
    }
    @container (max-width: 360px) {
        .level-row {
            grid-template-columns: 12px minmax(0, 1fr) 39px;
            gap: 5px;
            font-size: 12px;
        }
    }
</style>


<script lang="ts">
    import { onMount } from "svelte";
    import * as settings from "../../states/settings.svelte";
    import { levelText, type AudioLevels } from "../../audio/levels";
    import * as meterDisplay from "./levelMeterDisplay";

    const { levels }: { levels: AudioLevels | null } = $props();
    const readout = $derived(settings.getPlayback().levelMeterReadout);
    let displayed = $state.raw<readonly meterDisplay.DisplayChannel[]>([]);
    const channelCount = $derived(displayed.length || 2);
    let displayState = meterDisplay.create();
    let frameId: number | null = null;

    function queueFrame(): void {
        if (frameId === null && !document.hidden) frameId = requestAnimationFrame(draw);
    }

    function draw(): void {
        frameId = null;
        const result = meterDisplay.frame(displayState, performance.now());
        displayed = result.channels;
        if (result.active) queueFrame();
    }

    $effect(() => {
        const current = levels;
        const stage = readout;
        if (document.hidden) return;
        meterDisplay.update(displayState, current, stage, performance.now());
        queueFrame();
    });

    onMount(() => {
        function cancelFrame(): void {
            if (frameId !== null) cancelAnimationFrame(frameId);
            frameId = null;
        }
        function visibilityChanged(): void {
            cancelFrame();
            if (document.hidden) return;
            // Resume from current measurements, not peaks collected while hidden.
            displayState = meterDisplay.create();
            meterDisplay.update(displayState, levels, readout, performance.now());
            queueFrame();
        }
        document.addEventListener("visibilitychange", visibilityChanged);
        return () => {
            cancelFrame();
            document.removeEventListener("visibilitychange", visibilityChanged);
        };
    });
</script>