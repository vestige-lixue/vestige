<section class="media-list">
    {#each mediaImport.getIds() as mediaId (mediaId)}
        <MediaItem {mediaId} />
    {/each}
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
    import * as mediaImport from "../../states/mediaImport.svelte";
    import MediaItem from "./MediaItem.svelte";
</script>