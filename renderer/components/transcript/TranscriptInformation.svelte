{@render details(information)}

{#snippet details(information: TranscriptInformation | null)}
    <div class="information" class:compact>
        {#if information?.original !== null && information?.original !== undefined}
            <div class="original" use:fitPreview={{ units: preview, compact }}></div>
        {/if}
        {#if !information || information.kind === "token"}
            <div class="probabilities">
                <span>
                    <span class="label">{i18n.t("transcript.information.tokenProbability")}</span>
                    <span class="value">{formatProbability(information?.probability)}</span>
                </span>
                <span>
                    <span class="label">{i18n.t("transcript.information.blankProbability")}</span>
                    <span class="value">{formatProbability(information?.blankProbability)}</span>
                </span>
            </div>
        {/if}
        <div class="range">
            {#if information?.range}
                {formatDuration(information.range.start, { precision: 2 })}–{formatDuration(information.range.end, { precision: 2 })} ({(information.range.end - information.range.start).toFixed(2)}s)
            {:else}—{/if}
            {#if information?.kind === "deletion"}
                <span class="length">{i18n.t("transcript.information.characters", { count: Array.from(information.original ?? "").length })}</span>
            {/if}
        </div>
        {#if information?.gaps?.length}
            <div class="gaps">{i18n.t("transcript.information.gaps", {
                count: information.gaps.length,
                duration: information.gaps.reduce((sum, gap) => sum + (gap.range ? gap.range.end - gap.range.start : 0), 0).toFixed(2)
            })}</div>
        {/if}
    </div>
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
        align-items: center;
    }
    .original {
        width: 360px;
        max-width: 100%;
        min-width: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        overflow: hidden;
        padding: 0 4px;
        text-align: left;
    }
    .original :global(.preview-deleted) {
        padding: 1px 4px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--c-danger) 10%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-danger) 20%, transparent);
        box-decoration-break: clone;
    }
    .original :global(.preview-whitespace) {
        color: color-mix(in srgb, var(--c-danger) 65%, var(--c-text));
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .original :global(.preview-gap), .gaps {
        color: var(--c-accent);
    }
    .compact .original {
        flex: 1;
        white-space: pre;
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
    .length {
        margin-left: 8px;
    }
    .gaps {
        text-align: center;
    }
    .compact .gaps {
        flex-shrink: 0;
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
    .probabilities > span {
        display: flex;
        align-items: baseline;
        gap: 6px;
        white-space: nowrap;
    }
    .label {
        color: var(--c-text-80p);
    }
    .value {
        width: 5ch;
        flex-shrink: 0;
        text-align: right;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { formatDuration } from "../../format";
    import { type TranscriptInformation } from "../../editor/informationModel";
    import { type InspectionInformation } from "../../editor/information";
    import { fitPreview, previewUnits } from "../../editor/preview";

    let { information, compact = false }: { information: InspectionInformation | null; compact?: boolean } = $props();
    const preview = $derived(information?.original ? previewUnits(information.original, "deleted", information.gaps, information.sourceFrom) : []);

    function formatProbability(value: number | null | undefined): string {
        return value == null ? "—" : `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
    }
</script>