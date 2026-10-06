<section>
    <div class="preview">
        {#if source}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video bind:this={element} crossorigin="anonymous" src={source} preload="metadata" class:audio={media?.kind === "audio"}
                ontimeupdate={event => {
                    if (event.currentTarget === element) observeTime();
                }}
                onloadedmetadata={event => {
                    if (event.currentTarget === element && element.currentSrc === source) applySeek();
                }}
                onseeked={event => {
                    if (event.currentTarget !== element || element.currentSrc !== source || element.seeking) return;
                    activeSeek = null;
                    applySeek();
                    observeTime();
                }}
                onended={event => {
                    if (event.currentTarget === element && element.currentSrc === source) player.setPlaying(false);
                }}
                onerror={event => {
                    if (mediaId && event.currentTarget === element && element.currentSrc === source) mediaImport.reportPlaybackFailure(mediaId, "unreadable", { kind: "media-playback-failed", code: element.error?.code ?? null, diagnostic: element.error?.message || null });
                }}
            ></video>
        {/if}
        {#if !source || media?.kind === "audio"}
            <span>{media?.name ?? i18n.t("player.noMedia")}</span>
        {/if}
    </div>
    <Controls />
</section>


<style>
    section {
        padding: 0 20px 16px;
        border-bottom: 1px solid var(--c-border);
    }
    .preview {
        display: grid;
        place-items: center;
        height: clamp(112px, 24vh, 200px);
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
    .preview span {
        padding: 16px;
        overflow-wrap: anywhere;
        /* Temporary placeholder color for the player preview. */
        color: #747b85;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { untrack } from "svelte";
    import Controls from "./Controls.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as player from "../../states/player.svelte";
    import { createPlaybackAudio, type PlaybackAudio } from "../../audio/playback";

    import * as project from "../../states/project.svelte";

    const mediaId = $derived(mediaSelection.get());
    const media = $derived(project.getMedia(mediaId));
    const source = $derived(player.getURL());
    const previewSeekInterval = 75;
    let element = $state<HTMLVideoElement>();
    let audio = $state.raw<PlaybackAudio | null>(null);
    let pendingSeek: { time: number; mode: player.SeekMode } | null = null;
    let activeSeek: number | null = null;
    let seekTimer: ReturnType<typeof setTimeout> | undefined;
    let lastSeekAt = -Infinity;
    let appliedSeek = -1;

    function observeTime(): void {
        if (mediaId && element?.currentSrc === source && !element.seeking && pendingSeek === null && activeSeek === null && player.getSeekMode() !== "preview") {
            project.observePlaybackTime(mediaId, element.currentTime);
        }
    }

    function applySeek(): void {
        clearTimeout(seekTimer);
        seekTimer = undefined;
        if (!element || element.currentSrc !== source || element.readyState < 1 || pendingSeek === null) return;
        const { time, mode } = pendingSeek;
        if (activeSeek !== null || element.seeking) {
            if (activeSeek !== null && Math.abs(activeSeek - time) < 0.001) {
                pendingSeek = null;
                return;
            }
            if (mode === "preview") return;
        }
        else if (Math.abs(element.currentTime - time) < 0.001) {
            pendingSeek = null;
            observeTime();
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
        audio?.reset();
        element.currentTime = time;
    }

    $effect(() => {
        const target = element;
        const url = source;
        if (!target || !url) return;
        const reportFailure = (error: unknown): void => {
            if (element !== target || player.getURL() !== url) return;
            console.error("稳定音量不可用，已恢复普通播放。", error);
            if (player.isVolumeStabilizationEnabled()) player.setVolumeStabilization(false);
        };
        let pipeline: PlaybackAudio | null = null;
        try {
            pipeline = untrack(() => createPlaybackAudio(target, player.getVolume(), player.isVolumeStabilizationEnabled(), reportFailure));
        }
        catch (error) {
            untrack(() => reportFailure(error));
        }
        audio = pipeline;
        return () => {
            clearTimeout(seekTimer);
            seekTimer = undefined;
            pendingSeek = null;
            activeSeek = null;
            lastSeekAt = -Infinity;
            appliedSeek = -1;
            target.pause();
            pipeline?.dispose();
            if (audio === pipeline) audio = null;
            target.removeAttribute("src");
            target.load();
        };
    });

    $effect(() => {
        const target = element;
        const url = source;
        const pipeline = audio;
        if (!target || !url) return;
        let cancelled = false;
        if (player.isPlaying()) {
            void (pipeline?.resume() ?? Promise.resolve()).then(async () => {
                if (!cancelled && element === target && player.getURL() === url && player.isPlaying()) await target.play();
            }).catch(() => {
                if (!cancelled && player.getURL() === url) player.setPlaying(false);
            });
        }
        else {
            target.pause();
            pipeline?.pause();
        }
        return () => {
            cancelled = true;
        };
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
        if (audio) audio.setVolume(volume);
        else if (element) element.volume = volume;
    });

    $effect(() => {
        const enabled = player.isVolumeStabilizationEnabled();
        if (audio) audio.setEnabled(enabled);
        else if (element && source && enabled) player.setVolumeStabilization(false);
    });
</script>