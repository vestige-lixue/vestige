<section class="media-list" class:sorting={reorder !== null} use:mediaReorder={{
    ids: mediaImport.getIds(), disabled: interfaceBlocked(),
    onpreview: preview => reorder = preview,
    onmove: (mediaId, beforeId) => runCommand({ kind: "moveMedia", mediaId, beforeId })
}}>
    {#each mediaImport.getIds() as mediaId (mediaId)}
        <MediaItem {mediaId} dragging={reorder?.mediaId === mediaId} />
    {:else}
        <div class="empty-state" class:project-hints={!project.projectState.project}>
            {#if project.projectState.project}
                {@render hint({ kind: "importMedia" }, "media.empty.importAction", "media.empty.description")}
            {:else}
                {@render hint({ kind: "newProject" }, "project.empty.newAction", "project.empty.newDescription")}
                {@render hint({ kind: "openProject" }, "project.empty.openAction", "project.empty.openDescription")}
            {/if}
        </div>
    {/each}
    {#if reorder?.insertion}
        <div class="insertion-line" style:top={`${reorder.insertion.top}px`} style:left={`${reorder.insertion.left}px`}
            style:width={`${reorder.insertion.width}px`}></div>
    {/if}
</section>

{#snippet hint(command: Command, label: ParseKeys, description: ParseKeys)}
    <div>
        <LocalizedText text={i18n.t(description)} slots={{ action, shortcut: keycap, extension }} />
        {#snippet action()}
            <button type="button" class="link-button focusable" onclick={() => runCommand(command)}>{i18n.t(label)}</button>
        {/snippet}
        {#snippet keycap()}<kbd>{shortcut(command)}</kbd>{/snippet}
        {#snippet extension()}<code>.vestige</code>{/snippet}
    </div>
{/snippet}


<style>
    .media-list {
        position: relative;
        align-self: stretch;
        min-height: 0;
        overflow-y: auto;
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
        text-align: center;
    }
    .empty-state > div {
        line-height: 1.8;
    }
    .project-hints {
        display: grid;
        gap: 24px;
        text-wrap: balance;
        word-break: keep-all;
    }
    .project-hints button {
        margin-inline-end: .5em;
    }
    .project-hints :is(kbd, code) {
        display: inline;
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
    import { type ParseKeys } from "i18next";
    import { shortcut } from "../../keybindings";
    import * as i18n from "../../i18n.svelte";
    import LocalizedText from "../util/LocalizedText.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as project from "../../states/project.svelte";
    import { interfaceBlocked, runCommand, type Command } from "../../states/commands";
    import MediaItem from "./MediaItem.svelte";
    import { mediaReorder, type MediaReorderPreview } from "./mediaReorder";

    let reorder = $state<MediaReorderPreview | null>(null);
</script>