<section class="media-list" class:sorting={reorder !== null} use:mediaReorder={{
    ids: mediaImport.getIds(), disabled: interfaceBlocked(),
    onpreview: preview => reorder = preview,
    onmove: (mediaId, beforeId) => runCommand({ kind: "moveMedia", mediaId, beforeId })
}}>
    {#each mediaImport.getIds() as mediaId (mediaId)}
        <MediaItem {mediaId} dragging={reorder?.mediaId === mediaId} />
    {:else}
        {#if project.projectState.project}
            <div class="empty-state">
                <LocalizedText text={i18n.t("media.empty.description")} slots={{ action: importAction, shortcut: importShortcut }} />
                {#snippet importAction()}<button class="link-button focusable" onclick={() => runCommand({ kind: "importMedia" })}>{i18n.t("media.empty.importAction")}</button>{/snippet}
                {#snippet importShortcut()}<kbd>{shortcut({ kind: "importMedia" })}</kbd>{/snippet}
            </div>
        {/if}
    {/each}
    {#if reorder?.insertion}
        <div class="insertion-line" style:top={`${reorder.insertion.top}px`} style:left={`${reorder.insertion.left}px`}
            style:width={`${reorder.insertion.width}px`}></div>
    {/if}
</section>


<style>
    .media-list {
        position: relative;
        align-self: stretch;
        min-height: 0;
        padding: 0 8px;
        overflow-y: auto;
        margin-bottom: auto;
        display: flex;
        flex-flow: column nowrap;
        gap: 8px;
        flex: 1;
        padding: 4px 8px;
        margin: -4px 0;
        container-type: scroll-state;
        container-name: media-list;
    }
    @container scroll-state(scrollable: y) {
        .media-list > :global(.media) {
            margin-right: -4px;
        }
    }
    .media-list.sorting, .media-list.sorting :global(*) {
        cursor: grabbing;
    }
    :global(body:has(.media-list.sorting) .tooltip-content) {
        visibility: hidden;
    }
    .insertion-line {
        position: absolute;
        height: 2px;
        border-radius: 1px;
        background: var(--c-accent);
        pointer-events: none;
        z-index: 1;
    }
    .empty-state {
        margin: auto 0;
        padding-bottom: 20vh;
        color: var(--c-text-80p);
        font-size: 14px;
        line-height: 1.8;
        text-align: center;
    }
    .empty-state button {
        color: inherit;
        text-underline-offset: .2em;
    }
    .empty-state kbd {
        white-space: nowrap;
    }
</style>


<script lang="ts">
    import { shortcut } from "../../keybindings";
    import * as i18n from "../../i18n.svelte";
    import LocalizedText from "../util/LocalizedText.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as project from "../../states/project.svelte";
    import { interfaceBlocked, runCommand } from "../../states/commands";
    import MediaItem from "./MediaItem.svelte";
    import { mediaReorder, type MediaReorderPreview } from "./mediaReorder";

    let reorder = $state<MediaReorderPreview | null>(null);
</script>