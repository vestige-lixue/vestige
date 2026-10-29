{@render details(information)}

{#snippet details(information: InspectionInformation | null)}
    <div class="information" class:compact class:deletion={information?.kind === "deletion"}>
        {#if preview.length}
            <div class="original" class:comparison={information?.kind === "selection"} use:fitPreview={{ units: preview, compact, suffix, deletion: information?.kind === "deletion" }}></div>
        {/if}
        {#if !information || information.kind === "token" || information.kind === "gap"}
            <div class="probabilities">
                {@render statistic(i18n.t("transcript.information.tokenProbability"), formatProbability(information?.probability))}
                {@render statistic(i18n.t("transcript.information.blankProbability"), formatProbability(information?.kind === "gap" ? 1 : information?.blankProbability))}
            </div>
        {/if}
        <div class="range">
            {#if information?.range}
                {formatDuration(information.range.start, { precision: 2 })}–{formatDuration(information.range.end, { precision: 2 })} ({(information.range.end - information.range.start).toFixed(2)}s)
            {:else}—{/if}
        </div>
        {#if information?.gaps?.length}
            <div class="gaps">{@render statistic(i18n.t("transcript.information.blankProbability"), i18n.t("transcript.information.gaps", {
                count: information.gaps.length,
                duration: information.gaps.reduce((sum, gap) => sum + (gap.range ? gap.range.end - gap.range.start : 0), 0).toFixed(2)
            }), true)}</div>
        {/if}
    </div>
{/snippet}

{#snippet statistic(label: string, value: string, flexible = false)}
    <span class="statistic">
        <span class="label">{label}</span>
        <span class="value" class:flexible>{value}</span>
    </span>
{/snippet}


<style>
    .information {
        display: flex;
        flex-direction: column;
        gap: 6px 20px;
        min-width: 0;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }
    .information, .information * {
        line-height: 1.5;
    }
    .information.compact {
        flex-direction: row;
        align-items: baseline;
        height: 1.5em;
    }
    .original {
        align-self: center;
        max-width: 100%;
        min-width: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-all;
        overflow: hidden;
        padding: .6em 4px 2px;
        text-align: left;
        line-height: 1.9;
    }
    .original :global(.preview-deleted) {
        padding: 0 3px;
        border: 1px solid color-mix(in srgb, var(--c-danger) 20%, transparent);
        border-radius: 4px;
        background: color-mix(in srgb, var(--c-danger) 10%, transparent);
        box-decoration-break: slice;
        color: var(--c-danger);
    }
    .deletion:not(.compact) .original {
        padding: 2px 2px 1px;
        overflow: clip visible;
    }
    .deletion:not(.compact) .original :global(.preview-deleted) {
        padding-inline: 1px;
    }
    .information:not(.compact) .comparison {
        padding: 0;
        line-height: inherit;
    }
    .comparison :global(.preview-deleted) {
        text-decoration-line: line-through;
    }
    .comparison :global(.preview-inserted) {
        text-decoration-line: underline;
        text-decoration-style: dashed;
        text-underline-offset: .15em;
    }
    .original :global(.transcript-event) {
        color: var(--c-accent);
    }
    .original :global(.transcript-event-anchor) {
        position: relative;
        display: inline;
        line-height: 0;
    }
    .original :global(.transcript-events) {
        position: absolute;
        bottom: 1.1em;
        left: 0;
        display: block;
        transform: translateX(-50%);
        line-height: 0;
    }
    .original :global(.transcript-event) {
        display: inline-grid;
        vertical-align: top;
        place-items: center;
        width: .8em;
        height: .8em;
        line-height: 0;
    }
    .original :global(.transcript-event-shape) {
        width: .55em;
        height: .45em;
        overflow: visible;
        fill: currentColor;
    }
    .original :global(.transcript-event-stroke) {
        fill: none;
        stroke: var(--c-background);
        stroke-width: 2px;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    .original :global(.preview-suffix) {
        color: var(--c-text-80p);
        white-space: nowrap;
    }
    .compact .original {
        flex: 1;
        align-self: auto;
        max-width: none;
        white-space: nowrap;
        line-height: 1.5;
        padding-block: 0;
        overflow: clip visible;
    }
    .range {
        white-space: nowrap;
        text-align: center;
    }
    .compact .range {
        order: -1;
        flex-shrink: 0;
        min-width: 0;
        max-width: 50%;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: left;
    }
    .gaps {
        display: flex;
        justify-content: center;
    }
    .compact .gaps {
        flex-shrink: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .probabilities {
        display: flex;
        flex-shrink: 0;
        flex-wrap: wrap;
        gap: 6px 20px;
        text-align: center;
    }
    .compact .probabilities {
        order: 2;
        flex-shrink: 1;
        flex-wrap: nowrap;
        min-width: 0;
        margin-left: auto;
        overflow: hidden;
    }
    .statistic {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
        white-space: nowrap;
    }
    .label {
        flex-shrink: 0;
        color: var(--c-text-80p);
    }
    .value {
        width: 5ch;
        flex-shrink: 0;
        text-align: right;
    }
    .value.flexible {
        width: auto;
        flex-shrink: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { formatDuration } from "../../format";
    import { type InspectionInformation } from "../../editor/information";
    import { fitPreview, previewUnits, comparisonPreview } from "../../editor/preview";

    let { information, compact = false }: { information: InspectionInformation | null; compact?: boolean } = $props();
    const preview = $derived(information?.kind === "selection" ? comparisonPreview(information.comparison)
        : information?.original ? previewUnits(information.original, "deleted", information.gaps, information.sourceFrom) : []);
    const suffix = $derived(information?.kind === "deletion" ? `(${Array.from(information.original ?? "").length})` : undefined);

    function formatProbability(value: number | null | undefined): string {
        return value == null ? "—" : `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
    }
</script>