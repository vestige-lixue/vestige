<section class="transcript" class:player-below={playerBelow}>
    {#if run && vestige}
        {#if settings.getEditing().informationDisplay === "bar"}
            <div class="information-bar">
                <TranscriptInformation information={transcript.getInspection()} duration={vestige.media.duration} compact />
            </div>
        {/if}
        {#if transcriptFind.state.open}<TranscriptFind />{/if}
        <div class="columns" bind:contentBoxSize={null, sizes => columnsWidth = sizes?.[0]?.inlineSize ?? 0}>
            {#each columns as column, index (column)}
                {#if index === 1}
                    <Resizer direction="vertical" thickness={dividerWidth} origin={availableWidth * (referenceOnLeft ? referenceRatio : 1 - referenceRatio)}
                        min={availableWidth * minReferenceTranscriptRatio} max={availableWidth * maxReferenceTranscriptRatio}
                        changeCB={resizeColumns} resetCB={() => void settingsAPI.update({ layout: { referenceTranscriptRatio: defaultSettings.layout.referenceTranscriptRatio } })} />
                {/if}
                {#if column === "primary"}
                    <div class="column" style:flex-grow={reference ? 1 - referenceRatio : 1}>
                        {#if reference}
                            <div class="column-header">{@render label(run, formatRunLabel(vestige.displayedRunIdx, run.startedAt))}</div>
                        {/if}
                        <div class="transcript-scroll" use:scrollWithControl>
                            <TranscriptEditor {vestige} {run} bind:editor={primaryEditor} />
                        </div>
                    </div>
                {:else if reference}
                    <div class="column reference-column" style:flex-grow={referenceRatio}>
                        <div class="column-header">
                            <DropdownSelector items={options} value={reference.id} onValueChange={chooseReference}>
                                {#snippet itemDetails(item)}<RunDetails run={item.run} />{/snippet}
                            </DropdownSelector>
                            <Tooltip text={i18n.t("transcript.reference.hide")} onclick={() => runCommand({ kind: "toggleReferenceTranscript" })}>
                                {#snippet child({ props })}
                                    <button {...props} type="button" class="icon-button hoverable activable focusable" aria-label={i18n.t("transcript.reference.hide")}>
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        {@html closeIcon}
                                    </button>
                                {/snippet}
                            </Tooltip>
                        </div>
                        <div class="transcript-scroll" use:scrollWithControl>
                            <TranscriptEditor {vestige} run={reference} reference bind:editor={referenceEditor} />
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
    {:else}
        <div class="placeholder">
            {mediaSelection.get() ? i18n.t("transcript.emptyMedia") : i18n.t("transcript.empty")}
            {#if vestige && mediaImport.isReady(vestige.media.id)}
                <span class="new-transcription">
                    <kbd>{shortcut(transcriptionCommand)}</kbd>
                    <button type="button" class="link-button focusable" disabled={commandDisabled(transcriptionCommand)} onclick={() => runCommand(transcriptionCommand)}>
                        {i18n.t("transcription.actions.new")}
                    </button>
                </span>
            {/if}
        </div>
    {/if}
</section>

{#snippet label(item: Run, caption: string)}
    <Tooltip tabindex={-1}>
        {#snippet text()}<RunDetails run={item} />{/snippet}
        {#snippet child({ props })}<span {...props} class="run-label">{caption}</span>{/snippet}
    </Tooltip>
{/snippet}

<style>
    .transcript {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        overflow-wrap: anywhere;
        font-size: 16px;
        line-height: 1.8;
    }
    .information-bar {
        flex-shrink: 0;
        padding: 10px 28px;
        background: var(--c-surface);
    }
    .transcript:not(.player-below) .information-bar {
        border-bottom: 1px solid var(--c-border);
    }
    .player-below .information-bar {
        order: 1;
        border-top: 1px solid var(--c-border);
    }
    .columns {
        display: flex;
        flex: 1;
        min-height: 0;
    }
    .column {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-width: 0;
    }
    .column-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        height: 40px;
        flex-shrink: 0;
        padding: 0 12px;
        border-bottom: 1px solid var(--c-border);
        font-size: 14px;
    }
    .column-header :global(.dropdownSelector) { width: auto; max-width: 100%; min-width: 0; padding: 3px 8px; }
    .column-header :global(.icon-button) { box-sizing: border-box; width: 26px; height: 26px; flex-shrink: 0; }
    .run-label { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .transcript-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        /* Repeated Tab focus restarts native smooth scrolling before it can reach the marker. */
        scroll-behavior: auto;
    }
    .placeholder {
        margin: 24px;
        color: var(--c-text-80p);
    }
    .new-transcription {
        display: inline-flex;
        align-items: baseline;
        gap: .5em;
    }
    .new-transcription button {
        color: inherit;
        text-underline-offset: .2em;
    }
</style>


<script lang="ts">
    import { untrack } from "svelte";
    import { type Editor } from "@tiptap/core";
    import { type Run } from "../../../shared/transcription/Run";
    import { minReferenceTranscriptRatio, maxReferenceTranscriptRatio } from "../../../shared/constants";
    import { defaultSettings } from "../../../shared/settings/defaults";
    import closeIcon from "../../../resources/icons/lucide--x.svg?raw";
    import { formatRunLabel } from "../../format";
    import { synchronizeTranscriptSelection } from "../../editor/referenceSelection";
    import { synchronizeTranscriptScroll } from "../../editor/referenceScroll";
    import Resizer from "../util/Resizer.svelte";
    import DropdownSelector from "../util/DropdownSelector.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import RunDetails from "./RunDetails.svelte";
    import * as i18n from "../../i18n.svelte";
    import TranscriptEditor from "./TranscriptEditor.svelte";
    import TranscriptFind from "./TranscriptFind.svelte";
    import * as transcriptFind from "../../states/transcriptFind.svelte";
    import TranscriptInformation from "./TranscriptInformation.svelte";
    import * as project from "../../states/project.svelte";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as transcript from "../../states/transcript.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as settingsAPI from "../../states/settings";
    import { shortcut } from "../../keybindings";
    import { commandDisabled, runCommand, type Command } from "../../states/commands";

    const { playerBelow = false }: { playerBelow?: boolean } = $props();
    let primaryEditor = $state.raw<Editor>();
    let referenceEditor = $state.raw<Editor>();
    const run = $derived(transcript.getRun());
    const vestige = $derived(project.getVestige(mediaSelection.get()));
    const reference = $derived(transcript.getReference());
    const dividerWidth = 3;
    let columnsWidth = $state(0);
    const availableWidth = $derived(Math.max(0, columnsWidth - dividerWidth));
    const referenceRatio = $derived(settings.getCurrent().layout.referenceTranscriptRatio);
    const referenceOnLeft = $derived(settings.getEditing().referenceTranscriptPosition === "left");
    const columns = $derived(!reference ? ["primary"] : referenceOnLeft ? ["reference", "primary"] : ["primary", "reference"]);
    const options = $derived(vestige?.runs.flatMap((item, index) => item === run ? []
        : [{ value: item.id, label: formatRunLabel(index, item.startedAt), run: item }]) ?? []);
    const transcriptionCommand = $derived<Command>({ kind: "openTranscriptionConfig", mediaId: mediaSelection.get() });

    function resizeColumns(leftWidth: number): void {
        if (!availableWidth) return;
        const share = (referenceOnLeft ? leftWidth : availableWidth - leftWidth) / availableWidth;
        const ratio = Math.max(minReferenceTranscriptRatio, Math.min(maxReferenceTranscriptRatio, share));
        if (ratio !== referenceRatio) void settingsAPI.update({ layout: { referenceTranscriptRatio: ratio } });
    }

    function chooseReference(id: string): void {
        if (vestige && options.some(option => option.value === id)) transcript.rememberReference(vestige.media.id, id);
    }

    $effect(() => {
        if (reference && vestige) transcript.rememberReference(vestige.media.id, reference.id);
    });

    $effect(() => {
        const left = primaryEditor, right = referenceEditor, duration = vestige?.media.duration;
        if (!left || !right || duration === undefined) return;
        return untrack(() => {
            const stopScroll = synchronizeTranscriptScroll(left, right, duration);
            const stopSelection = synchronizeTranscriptSelection(left, right, duration);
            return () => {
                stopSelection();
                stopScroll();
            };
        });
    });

    function scrollWithControl(element: HTMLElement): { destroy: () => void } {
        function wheel(event: WheelEvent): void {
            if (!event.ctrlKey || event.defaultPrevented) return;
            // Ctrl-wheel normally zooms the page instead of scrolling the editor.
            event.preventDefault();
            const line = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? parseFloat(getComputedStyle(element).lineHeight) || 16 : 1;
            const page = event.deltaMode === WheelEvent.DOM_DELTA_PAGE;
            element.scrollBy({
                left: event.deltaX * (page ? element.clientWidth : line),
                top: event.deltaY * (page ? element.clientHeight : line),
                behavior: "instant"
            });
        }
        element.addEventListener("wheel", wheel, { passive: false });
        return { destroy: () => element.removeEventListener("wheel", wheel) };
    }
</script>