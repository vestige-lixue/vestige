<section class="transcript">
    <article class="transcript-document">
        {#if run}
            <p>{#each run.transcript as segment, index (index)}<span class:current={player.getCurrentTime() >= segment.range.start && player.getCurrentTime() < segment.range.end}>{segment.token.text}</span>{/each}</p>
        {:else}
            <p class="placeholder">{mediaSelection.get() ? "此媒体暂无转写结果。" : "转写正文将在这里显示。"}</p>
        {/if}
    </article>
</section>


<style>
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
    .current {
        background: var(--c-selection);
    }
</style>


<script lang="ts">
    import * as player from "../../states/player.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as project from "../../states/project.svelte";

    const vestige = $derived(project.getVestige(mediaSelection.get()));
    const run = $derived(vestige?.runs[vestige.primaryRunIdx]);
</script>