<header class="title-bar">
    <ProjectStatus centered />
</header>


<style>
    .title-bar {
        -webkit-app-region: drag;
        container-type: inline-size;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-shrink: 0;
        height: env(titlebar-area-height);
        margin-bottom: var(--drag-region-margin);
        padding: 0 16px;
        min-width: 0;
    }
</style>


<script lang="ts">
    import ProjectStatus from "./ProjectStatus.svelte";
</script>