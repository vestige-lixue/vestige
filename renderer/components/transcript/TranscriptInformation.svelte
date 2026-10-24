{#if information?.kind === "events"}
    <div class="events" class:compact>
        {#each information.items as item (item.key)}
            <div class="event" class:deletion={item.kind === "deletion"}>
                <span class="kind">{i18n.t(item.kind === "deletion" ? "transcript.information.deletion" : "transcript.information.gap")}</span>
                {@render details(item)}
            </div>
        {/each}
    </div>
{:else}
    {@render details(information)}
{/if}

{#snippet details(information: TranscriptInformation | null)}
    <div class="information" class:compact>
        {#if information?.original !== null && information?.original !== undefined}
            <div class="original">{information.original || "—"}</div>
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
                {formatTime(information.range.start)}–{formatTime(information.range.end)} ({(information.range.end - information.range.start).toFixed(2)}s)
            {:else}—{/if}
        </div>
    </div>
{/snippet}


<style>
    .events {
        display: flex;
        flex-direction: column;
        gap: 12px 20px;
        min-width: 0;
        font-size: 13px;
    }
    .events.compact {
        gap: 6px;
    }
    .event {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .compact .event {
        flex-shrink: 0;
        max-width: 100%;
    }
    .kind {
        flex-shrink: 0;
        color: var(--c-accent);
        white-space: nowrap;
    }
    .deletion .kind {
        color: var(--c-danger);
    }
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
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        line-clamp: 4;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        overflow: hidden;
        text-align: center;
    }
    .compact .original {
        display: block;
        flex: 1;
        min-width: 0;
        white-space: pre;
        text-overflow: ellipsis;
    }
    .events.compact .information {
        flex: 1;
    }
    .events.compact .range {
        margin-left: auto;
    }
    .range {
        white-space: nowrap;
        text-align: center;
    }
    .compact .range {
        order: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
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
        flex-wrap: nowrap;
        margin-left: auto;
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
    import { type TranscriptInformation } from "../../../shared/transcript/information";
    import { type InspectionInformation } from "../../editor/information";

    let { information, compact = false }: { information: InspectionInformation | null; compact?: boolean } = $props();

    function formatTime(seconds: number): string {
        const centiseconds = Math.round(seconds * 100);
        const hours = Math.floor(centiseconds / 360000);
        const minutes = Math.floor(centiseconds / 6000) % 60;
        const remaining = ((centiseconds % 6000) / 100).toFixed(2).padStart(5, "0");
        return `${hours ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${remaining}`;
    }

    function formatProbability(value: number | null | undefined): string {
        return value == null ? "—" : `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
    }
</script>