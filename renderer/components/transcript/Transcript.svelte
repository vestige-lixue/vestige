<section class="transcript">
    {#if run && vestige}
        <TranscriptEditor {vestige} {run} />
    {:else}
        <div class="placeholder">{mediaSelection.get() ? i18n.t("transcript.emptyMedia") : i18n.t("transcript.empty")}</div>
    {/if}
</section>


<style>
    .transcript {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-wrap: anywhere;
        font-size: 16px;
        line-height: 1.8;
    }
    .placeholder {
        margin: 24px;
        color: var(--c-text-80p);
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import TranscriptEditor from "./TranscriptEditor.svelte";
    import * as project from "../../states/project.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as transcript from "../../states/transcript.svelte";

    const run = $derived(transcript.getRun());
    const vestige = $derived(project.getVestige(mediaSelection.get()));
</script>