<Modal bind:open width="860px" height="80%" beforeClose={() => !busy} escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={value => {
    if (!value) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.vocabulary.title")}</Dialog.Title>
    <div class="toolbar">
        <div class="search input-control">
            <input type="search" bind:this={searchInput} bind:value={search} spellcheck={false}
                aria-label={i18n.t("transcription.vocabulary.search")} placeholder={i18n.t("transcription.vocabulary.search")} />
            {#if search}
                <button type="button" class="clear icon-button hoverable activable focusable" aria-label={i18n.t("common.clear")}
                    onpointerdown={event => event.preventDefault()} onclick={() => {
                        search = "";
                        searchInput?.focus({ preventScroll: true });
                    }}>
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html closeIcon}
                </button>
            {/if}
        </div>
        <TextButton disabled={busy || !!snapshot.error} onclick={() => edit()}>{i18n.t("transcription.vocabulary.addRule")}</TextButton>
    </div>
    {#if snapshot.error}
        <div class="error-message" role="alert">{describeFailure(snapshot.error)}</div>
        <TextButton disabled={busy} onclick={() => void retry()}>{i18n.t("common.retry")}</TextButton>
    {/if}
    {#if failure}<div class="error-message" role="alert">{describeFailure(failure)}</div>{/if}
    <div class="rules">
        {#if !filtered.length}
            <div class="empty">{i18n.t(search ? "transcription.vocabulary.noResults" : "transcription.vocabulary.empty")}</div>
        {:else}
            <table>
                <thead><tr>
                    <th>{i18n.t("transcription.vocabulary.source")}</th>
                    <th>{i18n.t("transcription.vocabulary.replacement")}</th>
                    <th><span class="sr-only">{i18n.t("transcription.vocabulary.actions")}</span></th>
                </tr></thead>
                <tbody>
                    {#each filtered as rule (rule.id)}
                        {@const tabStop = rowTabStops.get(rule.id) ?? 0}
                        <tr class:inactive={!rule.enabled}>
                            <td class="rule-text">{rule.source}</td>
                            <td class="rule-text">{rule.replacement}</td>
                            <td><div class="row-actions" onkeydown={navigateButtonGroup}>
                                <Switch bind:checked={() => rule.enabled, enabled => void update({ kind: "save", rule: { ...rule, enabled } })} disabled={busy || !!snapshot.error}
                                    tabindex={tabStop === 0 ? 0 : -1} onfocus={() => rowTabStops.set(rule.id, 0)}
                                    aria-label={i18n.t("transcription.vocabulary.enableRule", { source: rule.source })}
                                />
                                <Tooltip text={editLabel} disabled={busy || !!snapshot.error} disableCloseOnTriggerClick={false} onclick={() => edit(rule)}
                                    tabindex={tabStop === 1 ? 0 : -1} onfocus={() => rowTabStops.set(rule.id, 1)}>
                                    {#snippet child({ props })}
                                        <button {...props} class="edit icon-button hoverable activable focusable" aria-label={editLabel}>
                                            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                            {@html editIcon}
                                        </button>
                                    {/snippet}
                                </Tooltip>
                                <ConfirmDeleteButton text={i18n.t("transcription.vocabulary.remove")} disabled={busy || !!snapshot.error}
                                    tabindex={tabStop === 2 ? 0 : -1} onfocus={() => rowTabStops.set(rule.id, 2)}
                                    size="30px" onconfirm={() => void update({ kind: "remove", id: rule.id })} />
                            </div></td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>
</Modal>

<style>
    .toolbar, .row-actions {
        display: flex;
        gap: 8px;
    }
    .toolbar { flex-wrap: wrap; }
    .search { display: flex; flex: 1; min-width: 140px; }
    .search:has(input:focus-visible) {
        outline: 2px solid var(--c-accent);
        outline-offset: 2px;
    }
    .search input {
        flex: 1;
        min-width: 0;
        padding: 8px 10px;
        border: none;
        border-radius: inherit;
        color: inherit;
        background: transparent;
        user-select: text;
    }
    .search input::-webkit-search-cancel-button { display: none; }
    .clear {
        flex: none;
        align-self: center;
        width: calc(1lh + 16px);
        aspect-ratio: 1;
        padding: 0;
        border-radius: 5px;
        color: inherit;
    }
    .clear :global(svg) { width: 16px; height: 16px; }
    .rules { min-height: 120px; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: 12px 8px; border-bottom: 1px solid var(--c-border); }
    th { color: var(--c-text-80p); font-size: 13px; font-weight: normal; }
    td:last-child { width: 1%; border-inline-start: 1px solid var(--c-border); }
    .rule-text { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 240px; user-select: text; }
    .inactive .rule-text { color: var(--c-text-80p); }
    .row-actions { align-items: center; justify-content: flex-end; white-space: nowrap; }
    .row-actions :global(.icon-button svg) { width: 18px; height: 18px; }
    .edit { box-sizing: border-box; flex-shrink: 0; width: 30px; height: 30px; color: inherit; }
    .edit:disabled { opacity: 0.4; }
    .empty { padding: 32px 8px; text-align: center; color: var(--c-text-80p); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>

<script lang="ts">
    import { Dialog } from "bits-ui";
    import { tick } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import { type VocabularyRule, type VocabularyChange } from "../../../shared/vocabulary/Vocabulary";
    import { type FailureInfo } from "../../../shared/failure";
    import * as i18n from "../../i18n.svelte";
    import * as vocabulary from "../../states/vocabulary.svelte";
    import * as vocabularyAPI from "../../states/vocabulary";
    import * as dialogs from "../../states/dialogs";
    import * as modal from "../../states/modal.svelte";
    import { describeFailure } from "../../failures";
    import { navigateButtonGroup } from "../../dom";
    import Modal from "../util/Modal.svelte";
    import TextButton from "../util/TextButton.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import ConfirmDeleteButton from "../util/ConfirmDeleteButton.svelte";
    import Switch from "../util/Switch.svelte";
    import closeIcon from "../../../resources/icons/carbon--close.svg?raw";
    import editIcon from "../../../resources/icons/lucide--square-pen.svg?raw";

    let { open = $bindable(), dialogId, onClosed }: { open: boolean; dialogId: string; onClosed: () => void } = $props();
    let search = $state("");
    let searchInput = $state<HTMLInputElement>();
    let pending = $state(false);
    let failure = $state<FailureInfo | null>(null);
    const rowTabStops = new SvelteMap<string, number>();
    const snapshot = $derived(vocabulary.getSnapshot());
    const busy = $derived(pending || vocabulary.operation.busy);
    const editLabel = $derived(i18n.t("transcription.vocabulary.edit"));
    const filtered = $derived(snapshot.rules.filter(rule => (rule.source + "\n" + rule.replacement).toLowerCase().includes(search.toLowerCase())));

    function edit(rule?: VocabularyRule): void {
        dialogs.show({ kind: "vocabulary-rule", parentId: dialogId, rule });
    }

    async function update(change: VocabularyChange): Promise<void> {
        const target = document.activeElement;
        failure = null;
        const result = await vocabularyAPI.change(change);
        if (!result.success) failure = result.error;
        // A pending write temporarily disables the focused button and can blur it.
        await tick();
        if (document.activeElement === document.body) modal.restoreFocus(target, { preventScroll: true });
    }

    async function retry(): Promise<void> {
        pending = true;
        try {
            await vocabularyAPI.reload();
        }
        finally {
            pending = false;
        }
    }
</script>