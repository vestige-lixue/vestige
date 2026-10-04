<section>
    <div class="preview">
        {#if source}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video bind:this={element} src={source} preload="metadata" class:audio={media?.kind === "audio"}
                ontimeupdate={event => {
                    if (mediaId && event.currentTarget === element && element.currentSrc === source && pendingSeek === null) project.observePlaybackTime(mediaId, element.currentTime);
                }}
                onloadedmetadata={event => {
                    if (event.currentTarget === element && element.currentSrc === source) applySeek();
                }}
                onseeked={event => {
                    if (event.currentTarget !== element || element.currentSrc !== source) return;
                    if (element && pendingSeek !== null && Math.abs(element.currentTime - pendingSeek) < 0.05) pendingSeek = null;
                    if (mediaId && element?.currentSrc === source && pendingSeek === null) project.observePlaybackTime(mediaId, element.currentTime);
                }}
                onended={event => {
                    if (event.currentTarget === element && element.currentSrc === source) player.setPlaying(false);
                }}
                onerror={event => {
                    if (mediaId && event.currentTarget === element && element.currentSrc === source) mediaImport.reportPlaybackFailure(mediaId, "unreadable", element.error?.message || "媒体播放器无法读取或解码此文件。");
                }}
            ></video>
        {/if}
        {#if !source || media?.kind === "audio"}
            <span>{media?.name ?? "尚未选择媒体"}</span>
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
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as player from "../../states/player.svelte";

    import * as project from "../../states/project.svelte";

    const mediaId = $derived(mediaSelection.get());
    const media = $derived(project.getMedia(mediaId));
    const source = $derived(player.getURL());
    let element = $state<HTMLVideoElement>();
    let pendingSeek: number | null = null;
    let appliedSeek = -1;

    function applySeek(): void {
        if (!element || element.readyState < 1 || pendingSeek === null) return;
        if (!element.seeking && Math.abs(element.currentTime - pendingSeek) < 0.001) pendingSeek = null;
        else element.currentTime = pendingSeek;
    }

    $effect(() => {
        const target = element;
        if (!target || !source) return;
        return () => {
            target.pause();
            target.removeAttribute("src");
            target.load();
        };
    });

    $effect(() => {
        const target = element;
        const url = source;
        if (!target || !url) return;
        if (player.isPlaying()) {
            void target.play().catch(() => {
                if (player.getURL() === url) player.setPlaying(false);
            });
        }
        else target.pause();
    });

    $effect(() => {
        const version = player.getSeekVersion();
        const target = element;
        const url = source;
        if (version !== appliedSeek) {
            appliedSeek = version;
            pendingSeek = untrack(player.getCurrentTime);
        }
        if (target && url) untrack(applySeek);
    });

    $effect(() => {
        if (element) element.playbackRate = player.getSpeed();
    });
</script>