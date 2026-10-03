<section>
    <div class="preview">
        {#if source}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video bind:this={element} src={source} preload="metadata" class:audio={playerState.media?.kind === "audio"}
                ontimeupdate={() => {
                    if (element && pendingSeek === null) playerState.currentTime = element.currentTime;
                }}
                onloadedmetadata={applySeek}
                onseeked={() => {
                    if (element && pendingSeek !== null && Math.abs(element.currentTime - pendingSeek) < 0.05) pendingSeek = null;
                    if (element && pendingSeek === null) playerState.currentTime = element.currentTime;
                }}
                onended={() => {
                    playerState.playing = false;
                }}
                onerror={() => {
                    if (item && element?.currentSrc === source) mediaImports.playbackFailed(item);
                }}
            ></video>
        {/if}
        {#if !source || playerState.media?.kind === "audio"}
            <span>{item?.vestige?.media.name ?? "尚未选择媒体"}</span>
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
        color: var(--c-muted);
    }
</style>


<script lang="ts">
    import { untrack } from "svelte";
    import Controls from "./Controls.svelte";
    import { mediaImports } from "../../states/media.svelte";
    import { clearMedia, setMedia, playerState } from "../../states/player.svelte";

    const item = $derived(mediaImports.selected);
    let source = $state<string | null>(null);
    let element = $state<HTMLVideoElement>();
    let pendingSeek: number | null = null;
    let appliedSeek = -1;

    function applySeek(): void {
        if (!element || element.readyState < 1 || pendingSeek === null) return;
        if (!element.seeking && Math.abs(element.currentTime - pendingSeek) < 0.001) pendingSeek = null;
        else element.currentTime = pendingSeek;
    }

    $effect(() => {
        const selected = item;
        const media = selected?.stage === "ready" && !selected.ignored ? selected.vestige?.media : null;
        const path = media?.path;
        let disposed = false;
        let sourceId: string | null = null;
        source = null;
        untrack(clearMedia);
        if (media && path) {
            void window.api.file.openMediaSource(path).then(handle => {
                if (disposed) {
                    window.api.file.closeMediaSource(handle.id);
                    return;
                }
                sourceId = handle.id;
                source = handle.url;
                setMedia(media);
            }).catch(() => {
                if (!disposed && selected) mediaImports.playbackFailed(selected);
            });
        }
        return () => {
            disposed = true;
            if (sourceId) window.api.file.closeMediaSource(sourceId);
        };
    });

    $effect(() => {
        const target = element;
        const url = source;
        if (!target || !url) return;
        if (playerState.playing) {
            void target.play().catch(() => {
                if (source === url) playerState.playing = false;
            });
        }
        else target.pause();
    });

    $effect(() => {
        const version = playerState.seekVersion;
        const target = element;
        const url = source;
        if (version !== appliedSeek) {
            appliedSeek = version;
            pendingSeek = untrack(() => playerState.currentTime);
        }
        if (target && url) untrack(applySeek);
    });

    $effect(() => {
        if (element) element.playbackRate = playerState.speed;
    });
</script>