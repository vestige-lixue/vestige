<svelte:document onvisibilitychange={() => {
    if (document.hidden) stop();
}} />
<svelte:window onpagehide={() => stop()} />

<div class="audio-sync">
    <div class="setting">
        <label for="audio-offset" class="text">
            <span>{i18n.t("settings.playback.audioOffset.label")}</span>
            <span class="description" class:error-message={!validAudioOffsetMs(value)}>{validAudioOffsetMs(value)
                ? i18n.t("settings.playback.audioOffset.description")
                : i18n.t("settings.playback.audioOffset.invalid", { min: minAudioOffsetMs, max: maxAudioOffsetMs })}</span>
        </label>
        <div class="controls">
            <NumberInput id="audio-offset" unit="ms" min={minAudioOffsetMs} max={maxAudioOffsetMs} step="1"
                bind:ref={input} bind:value {disabled} oninput={event => {
                    const offset = event.currentTarget.valueAsNumber;
                    if (validAudioOffsetMs(offset)) onchange(offset);
                }} />
            <TextButton bind:ref={toggleButton} {disabled} onclick={() => active ? stop() : void start()}>
                {i18n.t(active ? "settings.playback.audioOffset.end" : "settings.playback.audioOffset.start")}
            </TextButton>
        </div>
    </div>
    {#if error}<div class="error-message">{error}</div>{/if}
    {#if active}
        <div class="test">
            <div class="test-heading description">{i18n.t("settings.playback.audioOffset.instruction")}</div>
            <div class="track">
                <div class="rule"></div>
                {#each [1, 2, 3] as beat (beat)}
                    <div class="tick" class:target={beat === 3} style:left={`${10 + beat * 20}%`}></div>
                {/each}
                <div class="sweep">
                    <div class="line" style:left={`${linePosition}%`}></div>
                </div>
            </div>
            <div class="tap-row">
                <TextButton class="calibrationTap" bind:ref={tapButton} {disabled} onpointerdown={event => {
                    if (event.button !== 0 || !event.isPrimary) return;
                    tap(event.timeStamp);
                }} onkeydown={event => {
                    if (event.key !== " " && event.key !== "Enter") return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (!event.repeat) tap(event.timeStamp);
                }}>
                    {i18n.t("settings.playback.audioOffset.tap")}
                </TextButton>
            </div>
        </div>
    {/if}
</div>


<style>
    .audio-sync {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
    }
    .setting {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
    }
    .text {
        display: flex;
        flex: 1 1 200px;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        line-height: 1.6;
    }
    .description {
        font-size: 13px;
        line-height: 1.6;
    }
    .description:not(.error-message) {
        color: var(--c-text-80p);
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }
    .controls :global(.number-input) {
        font-size: 15px;
    }
    .test {
        display: flex;
        flex-direction: column;
        gap: 16px;
        border-top: 1px solid var(--c-border);
        padding-top: 16px;
    }
    .test-heading {
        white-space: pre-line;
    }
    .track {
        position: relative;
        height: 80px;
        margin: 0 8px;
    }
    .rule {
        position: absolute;
        top: 50%;
        left: 12.5%;
        right: 12.5%;
        height: 1px;
        background: var(--c-border);
    }
    .tick {
        position: absolute;
        top: 50%;
        width: 2px;
        height: 21px;
        transform: translate(-50%, -50%);
        background: var(--c-text-80p);
    }
    .tick.target {
        width: 3px;
        height: 46px;
        background: var(--c-text);
    }
    .sweep {
        position: absolute;
        inset: 0;
        overflow: hidden;
        mask-image: linear-gradient(to right, transparent 15%, #000 25%, #000 75%, transparent 85%);
    }
    .line {
        position: absolute;
        top: 50%;
        width: 2px;
        height: 66px;
        transform: translate(-50%, -50%);
        border-radius: 1px;
        background: var(--c-accent);
    }
    .tap-row {
        display: flex;
        justify-content: center;
    }
    :global(.text-button.calibrationTap) {
        min-width: 190px;
        min-height: 58px;
        font-size: 18px;
    }
    :global(.text-button.calibrationTap:focus) {
        outline: 2px solid var(--c-accent);
        outline-offset: 2px;
    }
</style>


<script lang="ts">
    import { onMount, tick } from "svelte";
    import TextButton from "../util/TextButton.svelte";
    import NumberInput from "../util/NumberInput.svelte";
    import * as i18n from "../../i18n.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as playerAPI from "../../states/player";
    import * as calibration from "../../audio/calibration";
    import * as playback from "../../audio/playback";
    import { watchDefaultOutput } from "../../audio/outputDevices";
    import { minAudioOffsetMs, maxAudioOffsetMs } from "../../../shared/constants";
    import { validAudioOffsetMs } from "../../../shared/settings/validate";

    let { value = $bindable(), input = $bindable(), stopTest = $bindable(), disabled = false, onchange }: {
        value: number | undefined;
        input?: HTMLInputElement;
        stopTest?: () => void;
        disabled?: boolean;
        onchange: (value: number) => void;
    } = $props();
    // Keep resource ownership synchronous, including unmount before Svelte commits a start.
    let session: calibration.Calibration | null = null;
    let active = $state(false);
    let linePosition = $state(10);
    let error = $state("");
    let tapButton = $state<HTMLButtonElement | null>(null);
    let toggleButton = $state<HTMLButtonElement | null>(null);
    let frame: number | undefined;

    onMount(() => {
        stopTest = stop;
        const unwatch = watchDefaultOutput(() => stop());
        return () => {
            stop(false); stopTest = undefined; unwatch();
        };
    });

    $effect(() => {
        if (!active || !session) return;
        const current = settings.getPlayback();
        playback.setVolume(session.pipeline, current.volume);
        playback.setEnabled(session.pipeline, current.volumeStabilization);
        playback.setSettings(session.pipeline, settings.getVolumeStabilization());
    });

    function stop(focus = true): void {
        const old = session;
        session = null;
        active = false;
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = undefined;
        if (old) calibration.dispose(old);
        if (focus && old) toggleButton?.focus({ preventScroll: true });
    }

    function fail(cause: unknown): void {
        console.error("Audio synchronization calibration failed.", cause);
        stop();
        error = i18n.t("settings.playback.audioOffset.failed");
    }

    async function start(): Promise<void> {
        playerAPI.commitSeekPreview();
        playerAPI.pauseForInterruption();
        active = true;
        linePosition = 10;
        error = "";
        let test: calibration.Calibration | null = null;
        try {
            const current = settings.getPlayback();
            test = calibration.create(current.volume, current.volumeStabilization, settings.getVolumeStabilization(), () => stop(), fail);
            session = test;
            await calibration.start(test);
            if (session !== test) return;
            await tick();
            if (session !== test) return;
            tapButton?.focus({ preventScroll: true });
            const animate = (): void => {
                if (!test || session !== test) return;
                const time = calibration.getTime(test) + (validAudioOffsetMs(value) ? value : current.audioOffsetMs) / 1000;
                const phase = (time % calibration.cycleSeconds + calibration.cycleSeconds) % calibration.cycleSeconds;
                linePosition = 10 + phase / calibration.beatSeconds * 20;
                frame = requestAnimationFrame(animate);
            };
            animate();
        }
        catch (cause) {
            if (active && (!test || session === test)) fail(cause);
        }
    }

    function tap(timestamp: number): void {
        if (!session || disabled) return;
        const offsetMs = calibration.tap(session, timestamp);
        if (offsetMs === null) return;
        value = offsetMs;
        onchange(offsetMs);
    }
</script>