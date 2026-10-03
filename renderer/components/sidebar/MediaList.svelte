<section class="media-list">
    {#if projectState.project}
        {#each mediaImports.items as item (item)}
            <MediaItem {item} />
        {/each}
    {/if}
</section>


<style>
    .media-list {
        align-self: stretch;
        min-height: 0;
        padding: 8px;
        overflow-y: auto;
        margin-bottom: auto;
        display: flex;
        flex-flow: column nowrap;
        gap: 8px;
    }
</style>


<script lang="ts">
    import { mediaImports } from "../../states/media.svelte";
    import { projectState } from "../../states/project.svelte";
    import MediaItem from "./MediaItem.svelte";
</script>