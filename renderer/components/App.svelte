<FileDropOverlay busy={projectState.locked} />
<svelte:head>
    <title>{projectState.project ? `${getProjectFileName()} - Vestige` : "Vestige"}</title>
</svelte:head>
<SaveConfirmation />
<Sidebar />
<main>
    <Menu />
    {#if projectState.error}
        <p class="project-error">{projectState.error}</p>
    {/if}
    <Player />
    <section class="transcript">
        <article class="transcript-document">
            <p class="placeholder">转写正文将在这里显示。</p>
        </article>
    </section>
</main>


<style>
    main {
        display: flex;
        flex-flow: column nowrap;
    }
    .transcript {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        min-height: 0;
    }
    .transcript-document {
        padding: 24px 28px;
        overflow-y: auto;
        overflow-wrap: anywhere;
        font-size: 16px;
        line-height: 1.8;
    }
    .transcript-document p {
        margin: 0 0 1em;
    }
    .placeholder {
        color: var(--c-muted);
    }
    .project-error {
        margin: 0;
        padding: 8px 20px;
        overflow-wrap: anywhere;
        border-bottom: 1px solid var(--c-border);
    }
</style>


<script lang="ts">
    import { onMount } from "svelte";
    import Menu from "./Menu.svelte";
    import Player from "./Player.svelte";
    import Sidebar from "./Sidebar.svelte";
    import FileDropOverlay from "./FileDropOverlay.svelte";
    import SaveConfirmation from "./SaveConfirmation.svelte";
    import { getProjectFileName, projectState, startProjectLifecycle } from "../states/project.svelte";

    onMount(startProjectLifecycle);
</script>