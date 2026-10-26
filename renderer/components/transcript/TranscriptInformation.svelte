{@render details(information)}

{#snippet details(information: TranscriptInformation | null)}
    <div class="information" class:compact>
        {#if information?.original !== null && information?.original !== undefined}
            <div class="original" class:deleted={information.kind === "deletion"}>
                {#if information.kind === "deletion"}
                    <NiceLabel value={information.original} editable={false} onchange={() => {}}
                        scrollMode="ontime" scrollParam={2} scrollPause={1} autoScroll scrollPauseAtStart
                    >
                        <span class="deleted-text">{#each information.original.split(/(\r\n|[\r\n\t]|[^\S\r\n\t]+)/u) as part, index (index)}{#if part && /^\s+$/u.test(part)}<span
                            class="whitespace" class:line-break={/[\r\n]/u.test(part)}
                            data-symbol={part === "\t" ? "→\u00a0" : /[\r\n]/u.test(part) ? "↵" : "·".repeat(part.length)}
                        >{part}</span>{:else}{part}{/if}{/each}</span>
                    </NiceLabel>
                {:else}
                    {information.original || "—"}
                {/if}
            </div>
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
        </div>
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
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        line-clamp: 4;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        overflow: hidden;
        text-align: center;
    }
    .original.deleted {
        display: block;
        padding: 0 4px;
        white-space: pre;
    }
    .deleted-text {
        padding: 1px 4px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--c-danger) 10%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-danger) 20%, transparent);
        box-decoration-break: clone;
    }
    .whitespace {
        font-size: 0;
    }
    .whitespace::before {
        content: attr(data-symbol);
        color: color-mix(in srgb, var(--c-danger) 65%, var(--c-text));
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
    }
    .line-break {
        white-space: nowrap;
    }
    .compact .original {
        display: block;
        flex: 1;
        min-width: 0;
        white-space: pre;
        text-overflow: ellipsis;
    }
    .compact .original.deleted {
        flex: 0 1 auto;
        text-align: left;
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
    import NiceLabel from "../util/NiceLabel.svelte";

    let { information, compact = false }: { information: InspectionInformation | null; compact?: boolean } = $props();

    function formatProbability(value: number | null | undefined): string {
        return value == null ? "—" : `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
    }
</script>