<header class="title-bar">
    <ProjectStatus centered />
    {#if mediaSelection.get()}
        <div class="reference-toggle"><ReferenceTranscriptToggle /></div>
    {/if}
</header>


<style>
    .title-bar {
        -webkit-app-region: drag;
        container-type: inline-size;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-shrink: 0;
        height: env(titlebar-area-height);
        margin-bottom: var(--drag-region-margin);
        padding: 0 16px;
        min-width: 0;
    }
    .reference-toggle {
        position: absolute;
        right: 16px;
    }
</style>


<script lang="ts">
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import ProjectStatus from "./ProjectStatus.svelte";
    import ReferenceTranscriptToggle from "./ReferenceTranscriptToggle.svelte";
</script>