<Modal bind:open width="80%" height="80%" escBehavior={pending ? "ignore" : "close"} clickMaskBehavior={pending ? "ignore" : "close"} onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("settings.title")}</Dialog.Title>
    {#if config.isReady()}
        <div class="setting">
            <label for="interface-language">{i18n.t("settings.language")}</label>
            <select class="focusable" id="interface-language" bind:value={language} disabled={pending}>
                <option value="zh-CN">{i18n.t("languages.zh-CN")}</option>
                <option value="en">{i18n.t("languages.en")}</option>
            </select>
        </div>
        <section class="setting">
            <label for="transcription-concurrency">{i18n.t("settings.concurrency")}</label>
            <input class="focusable" id="transcription-concurrency" type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" bind:value={concurrency} disabled={pending} />
            <div>{i18n.t("settings.concurrencyHelp")}</div>
        </section>
    {:else}
        <section>{i18n.t("settings.loading")}</section>
    {/if}
    {#if attempted && !validConcurrency(concurrency)}
        <div class="error">{i18n.t("settings.invalidConcurrency")}</div>
    {/if}
    {#if failure}
        <div class="error">{i18n.t("settings.error", { error: describeFailure(failure) })}</div>
        {#if !config.isReady()}
            <button class="hoverable activable focusable" onclick={() => config.initialize()}>{i18n.t("settings.retry")}</button>
        {/if}
    {/if}
    {#snippet actions()}
        <button class="hoverable activable focusable" disabled={pending} onclick={() => {
            open = false;
        }}>{i18n.t("common.cancel")}</button>
        <button class="primary hoverable activable focusable" disabled={pending || !config.isReady()} onclick={save}>{i18n.t("common.save")}</button>
    {/snippet}
</Modal>


<style>
    .setting {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(100px, auto);
        align-items: center;
        gap: 8px 16px;
        margin-bottom: 24px;
    }
    .setting input, .setting select {
        min-width: 0;
        padding: 6px 8px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        background: var(--c-background);
        color: var(--c-text);
    }
    .setting > div {
        grid-column: 1 / -1;
        margin: 0;
        color: var(--c-text-80p);
        line-height: 1.6;
    }
    .error {
        color: var(--c-danger);
        overflow-wrap: anywhere;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../feedback";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as config from "../../states/config.svelte";
    import { defaultLocale, type Locale } from "../../../shared/locale";
    import { validConcurrency } from "../../../shared/config/defaults";

    let { open = $bindable(), onClosed }: { open: boolean; onClosed: () => void } = $props();
    let language = $state<Locale>(defaultLocale);
    let concurrency = $state<number | undefined>();
    let initialized = false;
    let pending = $state(false);
    let attempted = $state(false);
    const failure = $derived(config.getError());

    $effect(() => {
        const current = config.get();
        if (!initialized && current) {
            initialized = true;
            language = current.language;
            concurrency = current.transcription.concurrency;
        }
    });

    async function save(): Promise<void> {
        attempted = true;
        if (pending || !validConcurrency(concurrency)) return;
        pending = true;
        try {
            if (await config.update({ language, transcription: { concurrency } }) && await config.save()) open = false;
        }
        finally {
            pending = false;
        }
    }
</script>