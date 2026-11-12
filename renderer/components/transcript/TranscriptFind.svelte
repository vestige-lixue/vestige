<div class="transcript-find" role="search" aria-label={i18n.t("transcript.find.title")}
    oncompositionstart={() => transcriptFind.state.inputComposing = true} oncompositionend={() => transcriptFind.state.inputComposing = false}>
    <Tooltip text={i18n.t(transcriptFind.state.expanded ? "transcript.find.collapse" : "transcript.find.expand")}
        onclick={() => transcriptFind.state.expanded = !transcriptFind.state.expanded}>
        {#snippet child({ props })}
            <button {...props} type="button" class="expand icon-button hoverable activable focusable" aria-expanded={transcriptFind.state.expanded}
                aria-label={i18n.t(transcriptFind.state.expanded ? "transcript.find.collapse" : "transcript.find.expand")}>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html chevronIcon}
            </button>
        {/snippet}
    </Tooltip>
    <div class="input-field query-field">
        <input class="input-control focusable" data-transcript-find="query" bind:this={queryInput} value={transcriptFind.state.query}
            oninput={event => transcriptFind.setQuery(event.currentTarget.value)} aria-label={i18n.t("transcript.find.title")}
            placeholder={i18n.t("transcript.find.title")} spellcheck={false} />
        <div class="options">
            {@render option("toggleTranscriptFindCase", "caseSensitive", caseIcon, "transcript.find.caseSensitive")}
            {@render option("toggleTranscriptFindWord", "wholeWord", wordIcon, "transcript.find.wholeWord")}
        </div>
    </div>
    <div class="actions">
        <span class="count" class:empty={transcriptFind.state.count === 0} role="status" aria-live="polite">
            {#if transcriptFind.state.query}{transcriptFind.state.current + 1} / {transcriptFind.state.count}{/if}
        </span>
        {@render iconButton({ kind: "findTranscriptMatch", direction: -1 }, upIcon)}
        {@render iconButton({ kind: "findTranscriptMatch", direction: 1 }, downIcon)}
        {@render iconButton({ kind: "closeTranscriptFind" }, closeIcon)}
    </div>
    {#if transcriptFind.state.expanded}
        <div class="input-field replacement-field">
            <input class="input-control focusable" data-transcript-find="replacement" bind:this={replacementInput}
                bind:value={transcriptFind.state.replacement} aria-label={i18n.t("transcript.find.replacement")}
                placeholder={i18n.t("transcript.find.replacement")} spellcheck={false} />
            <div class="options">
                {@render option("toggleTranscriptFindPreserveCase", "preserveCase", preserveIcon, "transcript.find.preserveCase")}
            </div>
        </div>
        <div class="actions replacement-actions">
            {@render iconButton({ kind: "replaceTranscriptMatch" }, replaceIcon)}
            {@render iconButton({ kind: "replaceAllTranscriptMatches" }, replaceAllIcon)}
            <Tooltip text={i18n.t("transcript.find.addToVocabulary")} disabled={addDisabled} onclick={addToVocabulary}>
                {#snippet child({ props })}
                    <button {...props} type="button" class="icon-button hoverable activable focusable" aria-label={i18n.t("transcript.find.addToVocabulary")}>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html bookIcon}
                    </button>
                {/snippet}
            </Tooltip>
        </div>
    {/if}
</div>

{#snippet option(kind: "toggleTranscriptFindCase" | "toggleTranscriptFindWord" | "toggleTranscriptFindPreserveCase", name: "caseSensitive" | "wholeWord" | "preserveCase", icon: string, label: ParseKeys)}
    <Tooltip text={i18n.t(label)} shortcut={shortcut({ kind })} onclick={() => runCommand({ kind })}>
        {#snippet child({ props })}
            <button {...props} type="button" class="icon-button hoverable activable focusable" class:enabled={transcriptFind.state[name]} aria-pressed={transcriptFind.state[name]} aria-label={i18n.t(label)}>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html icon}
            </button>
        {/snippet}
    </Tooltip>
{/snippet}

{#snippet iconButton(command: Command, icon: string)}
    <Tooltip text={commandLabel(command)} shortcut={shortcut(command)} disabled={commandDisabled(command)} onclick={() => runCommand(command)}>
        {#snippet child({ props })}
            <button {...props} type="button" class="icon-button hoverable activable focusable" aria-label={commandLabel(command)}>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html icon}
            </button>
        {/snippet}
    </Tooltip>
{/snippet}

<style>
    .transcript-find {
        --find-input-height: 30px;
        --find-button-size: calc(var(--find-input-height) - 4px);
        display: grid;
        grid-template-columns: var(--find-button-size) minmax(0, 1fr) max-content;
        grid-auto-rows: var(--find-input-height);
        align-items: center;
        column-gap: 8px;
        row-gap: 4px;
        flex-shrink: 0;
        padding: 6px 20px;
        border-bottom: 1px solid var(--c-border);
        background: var(--c-surface);
        font-size: 14px;
        line-height: 1.5;
    }
    .transcript-find :global(.icon-button) {
        box-sizing: border-box;
        width: var(--find-button-size);
        height: var(--find-button-size);
        padding: 3px;
    }
    .transcript-find :global(.icon-button:disabled) { opacity: 0.5; }
    .transcript-find :global(.focusable:focus-visible) { outline-offset: 1px; }
    .transcript-find :global(.expand[aria-expanded="true"] svg) { transform: rotate(90deg); }
    .input-field { position: relative; min-width: 0; height: var(--find-input-height); }
    input { width: 100%; height: var(--find-input-height); padding: 4px 9px; }
    .query-field input { padding-right: calc(var(--find-button-size) * 2 + 10px); }
    .replacement-field input { padding-right: calc(var(--find-button-size) + 8px); }
    .options { position: absolute; right: 2px; top: 2px; display: flex; gap: 2px; }
    .options :global(.icon-button) { padding: 4px; border: 1px solid transparent; }
    .options :global(.enabled) { border-color: var(--c-accent); background-color: var(--c-selection); }
    .actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
    .count { min-width: 64px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .count.empty { color: var(--c-danger); }
    .replacement-field { grid-column: 2; }
    @media (max-width: 760px) {
        .transcript-find { column-gap: 5px; padding-inline: 10px; }
        .actions { gap: 3px; }
    }
</style>

<script lang="ts">
    import { tick } from "svelte";
    import { type ParseKeys } from "i18next";
    import * as i18n from "../../i18n.svelte";
    import * as transcriptFind from "../../states/transcriptFind.svelte";
    import * as vocabulary from "../../states/vocabulary.svelte";
    import * as dialogs from "../../states/dialogs";
    import { commandDisabled, commandLabel, runCommand, type Command } from "../../states/commands";
    import { shortcut } from "../../keybindings";
    import Tooltip from "../util/Tooltip.svelte";
    import chevronIcon from "../../../resources/icons/carbon--chevron-right.svg?raw";
    import closeIcon from "../../../resources/icons/carbon--close.svg?raw";
    import bookIcon from "../../../resources/icons/carbon--book.svg?raw";
    import caseIcon from "../../../resources/icons/codicon--case-sensitive.svg?raw";
    import wordIcon from "../../../resources/icons/codicon--whole-word.svg?raw";
    import upIcon from "../../../resources/icons/codicon--arrow-up.svg?raw";
    import downIcon from "../../../resources/icons/codicon--arrow-down.svg?raw";
    import replaceIcon from "../../../resources/icons/codicon--replace.svg?raw";
    import replaceAllIcon from "../../../resources/icons/codicon--replace-all.svg?raw";
    import preserveIcon from "../../../resources/icons/codicon--preserve-case.svg?raw";

    let queryInput: HTMLInputElement;
    let replacementInput = $state<HTMLInputElement>();
    const addDisabled = $derived(!transcriptFind.state.query || !!vocabulary.getSnapshot().error || vocabulary.operation.busy);

    $effect(() => {
        const request = transcriptFind.state.focusRequest;
        const replacement = transcriptFind.state.focusReplacement;
        void tick().then(() => {
            if (request !== transcriptFind.state.focusRequest) return;
            const input = replacement ? replacementInput : queryInput;
            input?.focus({ preventScroll: true });
            input?.select();
        });
    });

    function addToVocabulary(): void {
        if (addDisabled) return;
        dialogs.show({ kind: "vocabulary-rule", source: transcriptFind.state.query, replacement: transcriptFind.state.replacement });
    }
</script>