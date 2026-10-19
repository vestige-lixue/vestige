<section class="media-list">
    {#each mediaImport.getIds() as mediaId (mediaId)}
        <MediaItem {mediaId} />
    {:else}
        {#if project.projectState.project}
            <div class="empty-state">
                <LocalizedText text={i18n.t("media.empty.description")} slots={{ action: importAction, shortcut: importShortcut }} />
                {#snippet importAction()}<button class="link-button focusable" onclick={() => runCommand({ kind: "importMedia" })}>{i18n.t("media.empty.importAction")}</button>{/snippet}
                {#snippet importShortcut()}<kbd>{modKeyText}+I</kbd>{/snippet}
            </div>
        {/if}
    {/each}
</section>


<style>
    .media-list {
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
        .media-list > :global(*) {
            margin-right: -4px;
        }
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
    import * as i18n from "../../i18n.svelte";
    import LocalizedText from "../util/LocalizedText.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as project from "../../states/project.svelte";
    import { runCommand } from "../../states/commands";
    import MediaItem from "./MediaItem.svelte";

    const modKeyText = window.api.platform === "darwin" ? "⌘" : "Ctrl";
</script>