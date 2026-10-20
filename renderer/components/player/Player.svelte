<svelte:window bind:innerHeight={windowHeight} />

<section class:video={isVideo}>
    <div class="preview" style:height={`${previewHeight}px`} bind:contentBoxSize={null, sizes => previewWidth = sizes?.[0]?.inlineSize ?? 0}>
        {#if source}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video bind:this={element} crossorigin="anonymous" src={source} preload="metadata" class:audio={media?.kind === "audio"}
                ontimeupdate={event => {
                    if (event.currentTarget === element) observeTime();
                }}
                onpause={event => {
                    observePause(event.currentTarget);
                }}
                onloadedmetadata={event => {
                    if (event.currentTarget === element && element.currentSrc === source) {
                        observeVideoSize(event.currentTarget);
                        applySeek();
                    }
                }}
                onresize={event => observeVideoSize(event.currentTarget)}
                onseeked={event => {
                    if (event.currentTarget !== element || element.currentSrc !== source || element.seeking) return;
                    activeSeek = null;
                    recoveringSeek = false;
                    applySeek();
                    settleSeek();
                }}
                onended={event => {
                    if (event.currentTarget !== element || element.currentSrc !== source || !element.ended || element.seeking || seekedToEnd || settledSeek !== player.getSeekVersion()) return;
                    playerAPI.setPlaying(false);
                }}
                onerror={event => {
                    if (event.currentTarget === element && element.currentSrc === source) handlePlaybackError();
                }}
            ></video>
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
    video.audio {
        display: none;
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
    import { watchDefaultOutput } from "../../audio/outputDevices";
    import { type AudioLevels } from "../../audio/levels";

    import * as project from "../../states/project.svelte";
    import * as playerAPI from "../../states/player";
    import * as settingsAPI from "../../states/settings";
    import * as projectAPI from "../../states/project";
    import * as mediaImportAPI from "../../states/mediaImport";

    const { availableHeight }: { availableHeight: number } = $props();
    const mediaId = $derived(mediaSelection.get());
    const media = $derived(project.getMedia(mediaId));
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
    const previewSeekInterval = 75;
    const progressInterval = 100;
    let element = $state<HTMLVideoElement>();
    let audio = $state.raw<playbackAudio.PlaybackAudio | null>(null);
    let levels = $state.raw<AudioLevels | null>(null);
    let pendingSeek: { time: number; mode: player.SeekMode } | null = null;
    let activeSeek: number | null = null;
    let recoveringSeek = false;
    let seekTimer: ReturnType<typeof setTimeout> | undefined;
    let lastSeekAt = -Infinity;
    let appliedSeek = -1;
    let settledSeek = $state(-1);
    let seekedToEnd = false;
    const expectedPauses = new WeakMap<HTMLMediaElement, number>();

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
        if (target !== element || target.currentSrc !== source || target.videoWidth <= 0 || target.videoHeight <= 0) return;
        videoSize = { source: target.currentSrc, ratio: target.videoHeight / target.videoWidth };
    }

    function pauseElement(target: HTMLMediaElement): void {
        if (!target.paused) expectedPauses.set(target, (expectedPauses.get(target) ?? 0) + 1);
        target.pause();
    }

    function observePause(target: HTMLMediaElement): void {
        const expected = expectedPauses.get(target) ?? 0;
        if (expected > 0) expectedPauses.set(target, expected - 1);
        if (target !== element || target.currentSrc !== source) return;
        observeTime(true);
        if (expected > 0 || !target.paused || !player.isPlaying() || recoveringSeek) return;
        // Natural completion is handled by ended; seeking to EOF retains playback intent.
        if (target.ended || (target.duration > 0 && target.currentTime >= target.duration)) return;
        playerAPI.pauseForInterruption();
    }

    function observeTime(remember = false): void {
        if (mediaId && media && element?.currentSrc === source && settledSeek === player.getSeekVersion() && !element.seeking && pendingSeek === null && activeSeek === null && player.getSeekMode() !== "preview") {
            projectAPI.observePlaybackTime(mediaId, element.ended ? media.duration : element.currentTime, remember);
        }
    }

    function settleSeek(): void {
        if (!element || element.currentSrc !== source || element.readyState < 1 || element.seeking || pendingSeek !== null || activeSeek !== null || appliedSeek !== player.getSeekVersion()) return;
        recoveringSeek = false;
        seekedToEnd = element.ended || (element.duration > 0 && element.currentTime >= element.duration);
        settledSeek = appliedSeek;
        observeTime(true);
    }

    function applySeek(): void {
        clearTimeout(seekTimer);
        seekTimer = undefined;
        if (!element || element.currentSrc !== source || element.readyState < 1 || pendingSeek === null) return;
        const { mode } = pendingSeek;
        const time = Number.isFinite(element.duration) ? Math.min(pendingSeek.time, element.duration) : pendingSeek.time;
        if (time !== pendingSeek.time) {
            projectAPI.seekPlayback(time, mode);
            appliedSeek = player.getSeekVersion();
        }
        if (activeSeek !== null || element.seeking) {
            if (activeSeek !== null && Math.abs(activeSeek - time) < 0.001) {
                pendingSeek = null;
                return;
            }
            return;
        }
        else if (Math.abs(element.currentTime - time) < 0.001) {
            pendingSeek = null;
            settleSeek();
            return;
        }
        const delay = previewSeekInterval - (performance.now() - lastSeekAt);
        if (mode === "preview" && delay > 0) {
            seekTimer = setTimeout(applySeek, delay);
            return;
        }
        pendingSeek = null;
        activeSeek = time;
        lastSeekAt = performance.now();
        element.currentTime = time;
    }

    function handlePlaybackError(): void {
        if (!mediaId || !element) return;
        // FLAC seeks near EOF can leave Chromium's demuxer unable to seek again.
        // Reload once for this seek, retaining the latest target and playback intent.
        if (activeSeek !== null && !recoveringSeek) {
            recoveringSeek = true;
            clearTimeout(seekTimer);
            seekTimer = undefined;
            activeSeek = null;
            lastSeekAt = -Infinity;
            settledSeek = -1;
            pendingSeek = { time: player.getCurrentTime(), mode: player.getSeekMode() };
            expectedPauses.delete(element);
            element.load();
            return;
        }
        mediaImportAPI.reportPlaybackFailure(mediaId, "unreadable", { kind: "media-playback-failed", code: element.error?.code ?? null, diagnostic: element.error?.message || null });
    }

    $effect(() => {
        const target = element;
        const url = source;
        const id = mediaId;
        if (!target || !url) return;
        let pipeline: playbackAudio.PlaybackAudio | null = null;
        const unregister = playerAPI.registerProgressReader(() => {
            if (element !== target || player.getURL() !== url || mediaSelection.get() !== id) return;
            if (!player.isPlaying()) {
                pauseElement(target);
                if (pipeline) playbackAudio.pause(pipeline);
            }
            observeTime(true);
        });
        const reportFailure = (error: unknown): void => {
            if (element !== target || player.getURL() !== url) return;
            console.error("Volume stabilization is unavailable; ordinary playback has been restored.", error);
            if (player.isVolumeStabilizationEnabled()) playerAPI.setVolumeStabilization(false);
        };
        try {
            pipeline = untrack(() => playbackAudio.create(target, player.getVolume(), player.isVolumeStabilizationEnabled(), reportFailure, settings.getVolumeStabilization(), value => {
                if (element === target && player.getURL() === url) levels = value;
            }, () => {
                if (element === target && player.getURL() === url && audio === pipeline) playerAPI.pauseForInterruption();
            }));
        }
        catch (error) {
            untrack(() => reportFailure(error));
        }
        audio = pipeline;
        return () => {
            unregister();
            clearTimeout(seekTimer);
            seekTimer = undefined;
            pendingSeek = null;
            activeSeek = null;
            recoveringSeek = false;
            lastSeekAt = -Infinity;
            appliedSeek = -1;
            settledSeek = -1;
            seekedToEnd = false;
            target.pause();
            expectedPauses.delete(target);
            if (pipeline) playbackAudio.dispose(pipeline);
            if (audio === pipeline) audio = null;
            levels = null;
            target.removeAttribute("src");
            target.load();
        };
    });

    $effect(() => {
        const target = element;
        const url = source;
        const pipeline = audio;
        const version = player.getPlayVersion();
        if (!target || !url) return;
        let cancelled = false;
        if (player.isPlaying()) {
            // Initial restoration and paused seeks must finish before play can start.
            if (settledSeek !== player.getSeekVersion() || target.currentSrc !== url) return;
            if (target.ended || (target.duration > 0 && target.currentTime >= target.duration)) {
                // Keep playback intent at EOF so seeking back resumes without restarting here.
                pauseElement(target);
                if (pipeline) playbackAudio.pause(pipeline);
                return;
            }
            void (pipeline ? playbackAudio.resume(pipeline) : Promise.resolve()).then(async () => {
                if (!cancelled && element === target && player.getURL() === url && version === player.getPlayVersion() && player.isPlaying()) await target.play();
            }).catch(() => {
                if (!cancelled && player.getURL() === url && version === player.getPlayVersion()) playerAPI.setPlaying(false);
            });
        }
        else {
            pauseElement(target);
            if (pipeline) playbackAudio.pause(pipeline);
        }
        return () => {
            cancelled = true;
        };
    });

    $effect(() => {
        const target = element;
        const url = source;
        if (!target || !url || !player.isPlaying()) return;
        const timer = setInterval(() => {
            if (element === target && player.getURL() === url) observeTime(true);
        }, progressInterval);
        return () => clearInterval(timer);
    });

    $effect(() => {
        const version = player.getSeekVersion();
        const target = element;
        const url = source;
        if (version !== appliedSeek) {
            appliedSeek = version;
            pendingSeek = untrack(() => ({ time: player.getCurrentTime(), mode: player.getSeekMode() }));
        }
        if (target && url) untrack(applySeek);
    });

    $effect(() => {
        if (element) element.playbackRate = player.getSpeed();
    });

    $effect(() => {
        const volume = player.getVolume();
        if (audio) playbackAudio.setVolume(audio, volume);
        else if (element) element.volume = volume;
    });

    $effect(() => {
        const enabled = player.isVolumeStabilizationEnabled();
        if (audio) playbackAudio.setEnabled(audio, enabled);
        else if (element && source && enabled) playerAPI.setVolumeStabilization(false);
    });

    $effect(() => {
        if (audio) playbackAudio.setSettings(audio, settings.getVolumeStabilization());
    });
</script>