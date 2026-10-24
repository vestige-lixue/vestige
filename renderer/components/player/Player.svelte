<svelte:window bind:innerHeight={windowHeight} />

<section class:video={isVideo}>
    <div class="preview" style:height={`${previewHeight}px`} bind:contentBoxSize={null, sizes => previewWidth = sizes?.[0]?.inlineSize ?? 0}>
        {#if source && isVideo}
            {#key source}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video bind:this={video} crossorigin="anonymous" src={source} preload="auto" muted
                    onloadedmetadata={event => observeVideoSize(event.currentTarget)}
                    onresize={event => observeVideoSize(event.currentTarget)}
                ></video>
            {/key}
        {/if}
        {#if !source || media?.kind === "audio"}
            <Tooltip text={previewName} disabled={!nameTruncated}>
                {#snippet child({ props })}
                    <div {...props} class="preview-name" tabindex={nameTruncated ? 0 : undefined}>
                        <span bind:this={nameElement}>{previewName}</span>
                    </div>
                {/snippet}
            </Tooltip>
        {/if}
    </div>
    <div class="playback-controls" bind:borderBoxSize={null, sizes => controlsHeight = sizes?.[0]?.blockSize ?? 0}>
        <Controls {levels} />
    </div>
</section>
{#if isVideo}
    <Resizer
        direction="horizontal"
        origin={previewHeight}
        min={Math.min(minimumVideoHeight, maxVideoHeight)}
        max={maxVideoHeight}
        thickness={resizerThickness}
        changeCB={value => void settingsAPI.update({ layout: { videoHeight: value } })}
        resetCB={() => void settingsAPI.update({ layout: { videoHeight: null } })}
    />
{/if}


<style>
    section {
        flex-shrink: 0;
        min-width: 0;
        padding: 0 20px;
        border-bottom: 1px solid var(--c-border);
    }
    section.video {
        border-bottom: 0;
    }
    .preview {
        display: grid;
        place-items: center;
        min-width: 0;
        background: var(--c-surface);
        overflow: hidden;
    }
    video {
        width: 100%;
        height: 100%;
        min-height: 0;
        object-fit: contain;
    }
    .preview-name {
        min-width: 0;
        width: 100%;
        padding: 12px 16px;
        color: var(--c-text-80p);
        text-align: center;
    }
    .preview-name span {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
        overflow-wrap: anywhere;
        line-height: 20px;
    }
    .playback-controls {
        padding-bottom: 16px;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { onMount, untrack } from "svelte";
    import Controls from "./Controls.svelte";
    import Resizer from "../util/Resizer.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as player from "../../states/player.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as playbackAudio from "../../audio/playback";
    import * as playbackTransport from "../../audio/transport";
    import { watchDefaultOutput } from "../../audio/outputDevices";
    import { type AudioLevels } from "../../audio/levels";

    import * as project from "../../states/project.svelte";
    import * as playerAPI from "../../states/player";
    import * as settingsAPI from "../../states/settings";
    import * as projectAPI from "../../states/project";
    import * as mediaImportAPI from "../../states/mediaImport";
    import * as mediaImport from "../../states/mediaImport.svelte";

    const { availableHeight }: { availableHeight: number } = $props();
    const mediaId = $derived(mediaSelection.get());
    const media = $derived(mediaId !== null && mediaImport.isReady(mediaId) ? project.getMedia(mediaId) : null);
    const source = $derived(player.getURL());
    const isVideo = $derived(media?.kind === "video");
    const previewName = $derived(media?.name ?? i18n.t("player.noMedia"));
    const minimumVideoHeight = 112;
    const minimumTranscriptHeight = 160;
    const resizerThickness = 3;
    let windowHeight = $state(0);
    let previewWidth = $state(0);
    let controlsHeight = $state(0);
    let videoSize = $state<{ source: string; ratio: number } | null>(null);
    let nameElement = $state<HTMLSpanElement>();
    let nameTruncated = $state(false);
    const defaultVideoHeight = $derived(Math.min(200, Math.max(minimumVideoHeight, windowHeight * 0.24)));
    const maxVideoHeight = $derived(Math.min(
        Math.max(0, availableHeight - controlsHeight - resizerThickness - minimumTranscriptHeight),
        videoSize && videoSize.source === source ? previewWidth * videoSize.ratio : Infinity
    ));
    // Clamp only the displayed size so a larger window can restore the user's preference.
    const previewHeight = $derived(isVideo
        ? Math.min(maxVideoHeight, Math.max(minimumVideoHeight, settings.getVideoHeight() ?? defaultVideoHeight))
        : 64);
    let video = $state<HTMLVideoElement>();
    let audio = $state.raw<playbackAudio.PlaybackAudio | null>(null);
    let transport = $state.raw<playbackTransport.Transport | null>(null);
    let levels = $state.raw<AudioLevels | null>(null);

    onMount(() => watchDefaultOutput(() => {
        if (settings.getPlayback().pauseOnOutputDeviceChange) playerAPI.pauseForInterruption();
    }));

    $effect(() => {
        const target = nameElement;
        if (!target || !previewName) return;
        const observer = new ResizeObserver(() => {
            nameTruncated = target.scrollHeight > target.clientHeight + 1;
        });
        observer.observe(target);
        return () => observer.disconnect();
    });

    function observeVideoSize(target: HTMLVideoElement): void {
        if (target !== video || target.currentSrc !== source || target.videoWidth <= 0 || target.videoHeight <= 0) return;
        videoSize = { source: target.currentSrc, ratio: target.videoHeight / target.videoWidth };
    }

    $effect(() => {
        const url = source;
        const id = mediaId;
        const picture = isVideo ? video : null;
        if (!url || !id || !media || (isVideo && !picture)) return;
        const element = new Audio();
        element.crossOrigin = "anonymous";
        element.preload = "auto";
        let pipeline: playbackAudio.PlaybackAudio | null = null;
        let disposed = false;
        const current = (): boolean => !disposed && player.getURL() === url && mediaSelection.get() === id;
        const reportFailure = (error: unknown): void => {
            if (!current()) return;
            console.error("Volume stabilization is unavailable; ordinary playback has been restored.", error);
            if (player.isVolumeStabilizationEnabled()) playerAPI.setVolumeStabilization(false);
        };
        try {
            pipeline = untrack(() => playbackAudio.create(element, player.getVolume(), player.isVolumeStabilizationEnabled(), reportFailure, settings.getVolumeStabilization(), value => {
                if (current()) levels = value;
            }, () => {
                if (current()) playerAPI.pauseForInterruption();
            }));
        }
        catch (error) {
            untrack(() => reportFailure(error));
        }
        const controller = playbackTransport.create(element, picture ?? null, {
            duration: media.duration,
            resumeAudio: () => pipeline ? playbackAudio.resume(pipeline) : Promise.resolve(),
            pauseAudio: () => {
                if (pipeline) playbackAudio.pause(pipeline);
            },
            drainSeconds: () => pipeline ? (pipeline.processor ? pipeline.lookaheadFrames / pipeline.context.sampleRate : 0) + pipeline.context.baseLatency + (pipeline.context.outputLatency || 0) : 0,
            onTime: (time, remember) => {
                if (current()) projectAPI.observePlaybackTime(id, time, remember);
            },
            onEnded: () => {
                if (current()) playerAPI.finishPlayback();
            },
            onInterruption: () => {
                if (current()) playerAPI.pauseForInterruption();
            },
            onClamp: (time, mode) => {
                if (current()) projectAPI.seekPlayback(time, mode);
            },
            onError: target => {
                if (current()) mediaImportAPI.reportPlaybackFailure(id, "unreadable", { kind: "media-playback-failed", code: target.error?.code ?? null, diagnostic: target.error?.message || null });
            }
        });
        const unregister = playerAPI.registerProgressReader(() => {
            if (!current()) return;
            if (!player.isPlaying()) playbackTransport.setPlaying(controller, false);
            if (!controller.seeking && player.getSeekMode() !== "preview") projectAPI.observePlaybackTime(id, playbackTransport.getTime(controller), true);
        });
        element.src = url;
        audio = pipeline;
        transport = controller;
        return () => {
            disposed = true;
            unregister();
            playbackTransport.dispose(controller);
            if (pipeline) playbackAudio.dispose(pipeline);
            if (audio === pipeline) audio = null;
            if (transport === controller) transport = null;
            levels = null;
            for (const target of [element, picture]) {
                if (!target) continue;
                target.removeAttribute("src");
                target.load();
            }
        };
    });

    $effect(() => {
        const controller = transport;
        player.getSeekVersion();
        if (controller) untrack(() => playbackTransport.seek(controller, player.getCurrentTime(), player.getSeekMode()));
    });

    $effect(() => {
        const controller = transport;
        const speed = player.getSpeed();
        const offset = settings.getPlayback().audioOffsetMs;
        if (controller) untrack(() => playbackTransport.configure(controller, speed, offset));
    });

    $effect(() => {
        const controller = transport;
        const playing = player.isPlaying();
        player.getPlayVersion();
        if (controller) untrack(() => playbackTransport.setPlaying(controller, playing));
    });

    $effect(() => {
        const volume = player.getVolume();
        if (audio) playbackAudio.setVolume(audio, volume);
        else if (transport) transport.audio.volume = volume;
    });

    $effect(() => {
        const enabled = player.isVolumeStabilizationEnabled();
        if (audio) playbackAudio.setEnabled(audio, enabled);
        else if (transport && enabled) playerAPI.setVolumeStabilization(false);
    });

    $effect(() => {
        if (audio) playbackAudio.setSettings(audio, settings.getVolumeStabilization());
    });
</script>