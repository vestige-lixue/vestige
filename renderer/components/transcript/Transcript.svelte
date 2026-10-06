<section class="transcript">
    <article class="transcript-document">
        {#if run}
            <div>{#each run.transcript as segment, index (index)}<span class:current={highlighted[index]}>{segment.token.text}</span>{/each}</div>
        {:else}
            <div class="placeholder">{mediaSelection.get() ? i18n.t("transcript.emptyMedia") : i18n.t("transcript.empty")}</div>
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
    .transcript-document > div {
        margin: 0 0 1em;
    }
    .placeholder {
        color: var(--c-text-80p);
    }
    .current {
        background: var(--c-selection);
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { untrack } from "svelte";
    import { type Run } from "../../../shared/transcription/Run";
    import * as player from "../../states/player.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as transcript from "../../states/transcript.svelte";

    const run = $derived(transcript.getRun());
    let highlighted = $state<boolean[]>([]);
    let highlightedRun: Run | undefined;
    let active: ReadonlySet<number> = new Set();

    $effect(() => {
        const current = run;
        const next = new Set(transcript.getActiveSegments(player.getCurrentTime()));
        untrack(() => {
            if (highlightedRun !== current) {
                highlightedRun = current;
                highlighted = [];
                active = new Set();
            }
            for (const index of active) if (!next.has(index)) highlighted[index] = false;
            for (const index of next) if (!active.has(index)) highlighted[index] = true;
            active = next;
        });
    });
</script>