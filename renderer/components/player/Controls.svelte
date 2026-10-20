<svelte:window
    onkeyupcapture={handleProgressKeyup}
    onpointerdowncapture={cancelProgressNavigation}
    onpointerup={finishProgress}
    onpointercancel={finishProgress}
    onblur={finishProgress}
/>

<div class="controls"
    data-keyboard={keyboardFocus}
    onfocusin={() => keyboardFocus = keyboard.current}
    onkeydowncapture={() => keyboardFocus = true}
>
    <div class="progress-row">
        <div class="progress-outer">
            <Slider.Root
                class="slider progress"
                type="single"
                thumbPositioning="exact"
                min={0}
                max={progressSteps}
                step={1}
                {disabled}
                onpointerdowncapture={beginProgressDrag}
                onkeydowncapture={() => progressInput = "keyboard"}
                onkeydown={() => {
                    if (progressInput === "keyboard") progressInput = null;
                }}
                bind:value={() => progress, seek}
                onValueCommit={finishProgress}
            >
                <div class="track">
                    <Slider.Range class="slider-range" />
                </div>
                <Slider.Thumb
                    bind:ref={progressThumb}
                    index={0}
                    class="slider-thumb"
                    onkeydown={handleProgressKeydown}
                    onfocus={() => progressTooltipOpen = keyboard.current}
                    onblur={() => {
                        progressTooltipOpen = false;
                        cancelProgressNavigation();
                    }}
                />
            </Slider.Root>
        </div>
        <Tooltip text={i18n.t("player.actions.focusSlider")} shortcut={`${modKeyText}+⇧+P`} tabindex={-1} bind:open={progressTooltipOpen}>
            {#snippet child({ props })}
                <div {...props} class="time">{formatTime(player.getCurrentTime())} / {formatTime(duration)}</div>
            {/snippet}
        </Tooltip>
    </div>
    <div class="control-row">
        <div class="adjustment volume">
            <Tooltip onclick={() => runCommand({ kind: "toggleVolumeStabilization" })}>
                {#snippet text()}
                    <div class="shortcuts">
                        <div><b>{player.isVolumeStabilizationEnabled() ? i18n.t("player.actions.disableStabilization") : i18n.t("player.actions.enableStabilization")}</b> <kbd><b>{modKeyText}+E</b></kbd></div>
                        <div>{i18n.t("player.actions.focusSlider")} <kbd>{modKeyText}+⇧+E</kbd></div>
                    </div>
                {/snippet}
                {#snippet child({ props })}
                    <button {...props} class="icon-button hoverable activable focusable" class:enabled={player.isVolumeStabilizationEnabled()} type="button">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html player.isVolumeStabilizationEnabled() ? volumeAutoIcon : volumeUpIcon}
                    </button>
                {/snippet}
            </Tooltip>
            <Slider.Root
                class="slider"
                type="single"
                thumbPositioning="exact"
                min={0}
                max={100}
                step={1}
                onpointerdowncapture={() => keyboardFocus = false}
                bind:value={() => volumePosition, value => runCommand({ kind: "setPlaybackVolume", volume: sliderToVolume(value, settings.getPlayback()) })}
            >
                <div class="track">
                    <Slider.Range class="slider-range" />
                </div>
                <Slider.Thumb bind:ref={volumeThumb} index={0} class="slider-thumb" />
            </Slider.Root>
            <span class="value">{volumePosition}%</span>
        </div>
        <div class="buttons" onkeydown={handleButtonKeydown}>
            <Tooltip
                text={i18n.t("player.actions.previousMedia")}
                shortcut={`${modKeyText}+⇧+←`}
                disabled={buttonDisabled[0]}
                tabindex={tabStop === 0 ? 0 : -1}
                onfocus={() => focusedButton = 0}
                onclick={() => runCommand({ kind: "selectAdjacentMedia", direction: -1 })}
            >
                {#snippet child({ props })}
                    <button {...props} class="icon-button hoverable activable focusable" type="button">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html skipBackIcon}
                    </button>
                {/snippet}
            </Tooltip>
            <Tooltip
                text={player.isPlaying() ? i18n.t("player.actions.pause") : i18n.t("player.actions.play")}
                shortcut="Space"
                {disabled}
                tabindex={tabStop === 1 ? 0 : -1}
                onfocus={() => focusedButton = 1}
                onclick={() => runCommand({ kind: "playSelectedMedia" })}
            >
                {#snippet child({ props })}
                    <button {...props} class="icon-button hoverable activable focusable" type="button">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html player.isPlaying() ? pauseIcon : playIcon}
                    </button>
                {/snippet}
            </Tooltip>
            <Tooltip
                text={i18n.t("player.actions.nextMedia")}
                shortcut={`${modKeyText}+⇧+→`}
                disabled={buttonDisabled[2]}
                tabindex={tabStop === 2 ? 0 : -1}
                onfocus={() => focusedButton = 2}
                onclick={() => runCommand({ kind: "selectAdjacentMedia", direction: 1 })}
            >
                {#snippet child({ props })}
                    <button {...props} class="icon-button hoverable activable focusable" type="button">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html skipForwardIcon}
                    </button>
                {/snippet}
            </Tooltip>
            <Tooltip
                text={i18n.t("player.actions.previousWord")}
                shortcut={`${modKeyText}+←`}
                disabled={buttonDisabled[3]}
                tabindex={tabStop === 3 ? 0 : -1}
                onfocus={() => focusedButton = 3}
                onclick={() => runCommand({ kind: "seekAdjacentWord", direction: -1 })}
            >
                {#snippet child({ props })}
                    <button {...props} class="icon-button hoverable activable focusable" type="button">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html previousOutlineIcon}
                    </button>
                {/snippet}
            </Tooltip>
            <Tooltip
                text={i18n.t("player.actions.nextWord")}
                shortcut={`${modKeyText}+→`}
                disabled={buttonDisabled[4]}
                tabindex={tabStop === 4 ? 0 : -1}
                onfocus={() => focusedButton = 4}
                onclick={() => runCommand({ kind: "seekAdjacentWord", direction: 1 })}
            >
                {#snippet child({ props })}
                    <button {...props} class="icon-button hoverable activable focusable" type="button">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html nextOutlineIcon}
                    </button>
                {/snippet}
            </Tooltip>
        </div>
        <div class="adjustment speed">
            <Tooltip onclick={() => runCommand({ kind: "restorePlaybackSpeed" })}>
                {#snippet text()}
                    <div class="shortcuts">
                        <div><b>{i18n.t("player.actions.restoreSpeed")}</b> <kbd><b>{modKeyText}+R</b></kbd></div>
                        <div>{i18n.t("player.actions.focusSlider")} <kbd>{modKeyText}+⇧+R</kbd></div>
                    </div>
                {/snippet}
                {#snippet child({ props })}
                    <button {...props} class="icon-button hoverable activable focusable" type="button">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html meterAltIcon}
                    </button>
                {/snippet}
            </Tooltip>
            <Slider.Root
                class="slider"
                type="single"
                thumbPositioning="exact"
                min={player.minSpeed}
                max={player.maxSpeed}
                step={player.speedStep}
                onpointerdowncapture={() => keyboardFocus = false}
                bind:value={player.getSpeed, value => runCommand({ kind: "setPlaybackSpeed", speed: value })}
                onValueCommit={() => runCommand({ kind: "savePlaybackSpeed" })}
            >
                <div class="track">
                    <Slider.Range class="slider-range" />
                    <span class="normal-speed" style:left={100 * (1 - player.minSpeed) / (player.maxSpeed - player.minSpeed) + "%"}></span>
                </div>
                <Slider.Thumb bind:ref={speedThumb} index={0} class="slider-thumb" />
            </Slider.Root>
            <span class="value">{player.getSpeed().toFixed(2).replace(/0$/, "")}×</span>
        </div>
    </div>
    {#if mediaSelection.get() !== null && settings.getPlayback().showLevelMeter}
        <LevelMeter {levels} />
    {/if}
</div>


<style>
    .controls {
        container-type: inline-size;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 12px;
    }
    .progress-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .control-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 24px;
    }
    .buttons {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }
    .controls button {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        border-radius: 6px;
    }
    .controls button:disabled {
        opacity: 0.5;
    }
    .adjustment {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        max-width: 300px;
        min-width: 0;
    }
    .speed {
        justify-self: end;
    }
    .volume button.enabled {
        color: var(--c-accent);
    }
    .shortcuts {
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
        gap: 3px;
    }
    .shortcuts > div {
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        gap: 8px;
    }
    .value {
        flex-shrink: 0;
        width: 40px;
        text-align: right;
        white-space: nowrap;
        font-size: 14px;
        font-variant-numeric: tabular-nums;
        color: var(--c-text-80p);
    }
    .progress-outer {
        min-width: 0;
        flex: 1;
        padding: 0 6px;
    }
    .controls :global(.slider) {
        position: relative;
        display: flex;
        flex: 1;
        align-items: center;
        min-width: 0;
        height: 24px;
        cursor: pointer;
    }
    .controls :global(.slider[data-disabled]) {
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
    .controls :global(.slider-range) {
        position: absolute;
        height: 100%;
        border-radius: inherit;
        background: var(--c-accent);
    }
    .controls :global(.slider-thumb) {
        display: block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--c-accent);
    }
    .controls[data-keyboard="true"] :global(.slider-thumb:focus) {
        outline: 2px solid var(--c-accent);
        outline-offset: 3px;
    }
    .normal-speed {
        position: absolute;
        top: -2px;
        width: 2px;
        height: 8px;
        background: var(--c-text-80p);
        transform: translateX(-50%);
    }
    .time {
        white-space: nowrap;
        font-size: 14px;
        font-variant-numeric: tabular-nums;
        color: var(--c-text-80p);
    }
    @container (max-width: 520px) {
        .control-row {
            gap: 12px;
        }
        .buttons {
            gap: 4px;
        }
        .controls button {
            width: 20px;
            height: 20px;
        }
        .adjustment {
            display: grid;
            grid-template-columns: 20px minmax(0, 1fr);
            gap: 0 6px;
        }
        .adjustment :global(.slider) {
            grid-column: 1 / -1;
            grid-row: 2;
            height: 20px;
            margin: 0 6px;
        }
        .value {
            grid-column: 2;
            grid-row: 1;
            width: auto;
            text-box: trim-both cap alphabetic;
        }
    }
</style>


<script lang="ts">
    import LevelMeter from "./LevelMeter.svelte";
    import { type AudioLevels } from "../../audio/levels";
    import { sliderToVolume, volumeToSlider } from "../../audio/volume";

    import * as i18n from "../../i18n.svelte";
    import { onDestroy, onMount } from "svelte";
    import { register as registerFocus } from "../../focus";
    import { IsUsingKeyboard, Slider } from "bits-ui";
    import Tooltip from "../util/Tooltip.svelte";
    import * as player from "../../states/player.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as project from "../../states/project.svelte";

    import { commandDisabled, runCommand } from "../../states/commands";
    import skipBackIcon from "../../../resources/icons/carbon--skip-back.svg?raw";
    import playIcon from "../../../resources/icons/carbon--play.svg?raw";
    import pauseIcon from "../../../resources/icons/carbon--pause.svg?raw";
    import skipForwardIcon from "../../../resources/icons/carbon--skip-forward.svg?raw";
    import volumeUpIcon from "../../../resources/icons/carbon--volume-up.svg?raw";
    import volumeAutoIcon from "../../../resources/icons/volume-auto.svg?raw";
    import meterAltIcon from "../../../resources/icons/carbon--meter-alt.svg?raw";
    import previousOutlineIcon from "../../../resources/icons/carbon--previous-outline.svg?raw";
    import nextOutlineIcon from "../../../resources/icons/carbon--next-outline.svg?raw";
    import * as playerAPI from "../../states/player";

    const { levels }: { levels: AudioLevels | null } = $props();
    const modKeyText = window.api.platform === "darwin" ? "⌘" : "Ctrl";
    const keyboard = new IsUsingKeyboard();
    let keyboardFocus = $state(false);
    let progressTooltipOpen = $state(false);
    let progressInput: "pointer" | "keyboard" | null = null;
    let progressNavigation: {
        direction: -1 | 1;
        mediaId: string | null;
        time: number;
        seekVersion: number;
    } | null = null;

    onDestroy(finishProgress);

    $effect(() => {
        player.getURL();
        progressInput = null;
        cancelProgressNavigation();
    });

    // Keep the slider's step rounding from writing back to the precise playback time.
    const progressSteps = 1000;
    const volumePosition = $derived(volumeToSlider(player.getVolume(), settings.getPlayback()));
    const duration = $derived(project.getMedia(mediaSelection.get())?.duration ?? 0);
    const disabled = $derived(!player.getURL() || !Number.isFinite(duration) || duration <= 0);
    const progress = $derived(disabled || !Number.isFinite(player.getCurrentTime())
        ? 0
        : Math.round(Math.min(1, Math.max(0, player.getCurrentTime() / duration)) * progressSteps));

    let progressThumb = $state<HTMLSpanElement | null>(null);
    let speedThumb = $state<HTMLSpanElement | null>(null);
    let volumeThumb = $state<HTMLSpanElement | null>(null);

    onMount(() => {
        const unregisterProgress = registerFocus("playback-progress", () => {
            if (disabled) return;
            keyboardFocus = keyboard.current;
            progressThumb?.focus({ preventScroll: true });
            progressTooltipOpen = keyboard.current;
        });
        const unregisterSpeed = registerFocus("playback-speed", () => {
            keyboardFocus = keyboard.current;
            speedThumb?.focus({ preventScroll: true });
        });
        const unregisterVolume = registerFocus("playback-volume", () => {
            keyboardFocus = keyboard.current;
            volumeThumb?.focus({ preventScroll: true });
        });
        return () => {
            unregisterProgress();
            unregisterSpeed();
            unregisterVolume();
        };
    });

    let focusedButton = $state(0);
    const buttonDisabled = $derived([
        commandDisabled({ kind: "selectAdjacentMedia", direction: -1 }),
        disabled,
        commandDisabled({ kind: "selectAdjacentMedia", direction: 1 }),
        commandDisabled({ kind: "seekAdjacentWord", direction: -1 }),
        commandDisabled({ kind: "seekAdjacentWord", direction: 1 })
    ]);
    const tabStop = $derived(buttonDisabled[focusedButton] ? buttonDisabled.findIndex(disabled => !disabled) : focusedButton);

    function handleButtonKeydown(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        if (!(event.currentTarget instanceof HTMLDivElement) || !(event.target instanceof HTMLButtonElement)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const index = buttons.indexOf(event.target);
        if (index < 0) return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        buttons[(index + direction + buttons.length) % buttons.length]?.focus();
    }

    function handleProgressKeydown(event: KeyboardEvent): void {
        if (disabled || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
            || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
            cancelProgressNavigation();
            return;
        }
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const mediaId = mediaSelection.get();
        const seekVersion = player.getSeekVersion();
        // Continue from this held key's last target, even while playback advances.
        const time = event.repeat && progressNavigation?.direction === direction && progressNavigation.mediaId === mediaId
            && progressNavigation.seekVersion === seekVersion ? progressNavigation.time : player.getCurrentTime();
        runCommand({
            kind: "seekSelectedMedia",
            time: direction === 1 ? Math.floor(time) + 1 : Math.ceil(time) - 1
        });
        const nextVersion = player.getSeekVersion();
        progressNavigation = nextVersion === seekVersion + 1
            ? { direction, mediaId, time: player.getCurrentTime(), seekVersion: nextVersion } : null;
    }

    function handleProgressKeyup(event: KeyboardEvent): void {
        if (progressNavigation && event.key === (progressNavigation.direction === -1 ? "ArrowLeft" : "ArrowRight")) cancelProgressNavigation();
    }

    function cancelProgressNavigation(): void {
        progressNavigation = null;
    }

    function beginProgressDrag(event: PointerEvent): void {
        keyboardFocus = false;
        progressTooltipOpen = false;
        if (event.button === 0 && !disabled) progressInput = "pointer";
    }

    function finishProgress(): void {
        progressInput = null;
        cancelProgressNavigation();
        playerAPI.commitSeekPreview();
    }

    function seek(progress: number): void {
        if (disabled || progressInput === null) return;
        runCommand({ kind: "seekSelectedMedia", time: progress / progressSteps * duration, mode: progressInput === "pointer" ? "preview" : "commit" });
    }

    function formatTime(time: number): string {
        const seconds = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
        const minutes = Math.floor(seconds / 60);
        const remainder = String(seconds % 60).padStart(2, "0");
        if (minutes < 60) return `${String(minutes).padStart(2, "0")}:${remainder}`;
        return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}`;
    }
</script>