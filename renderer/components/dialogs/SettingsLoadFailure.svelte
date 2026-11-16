<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    width="560px"
    beforeClose={() => settings.getSnapshot()?.loadError === null}
    onOpenChangeComplete={isOpen => {
        if (!isOpen) onClosed();
    }}
>
    <Dialog.Title class="modal-title">{i18n.t("settings.loadFailure.title")}</Dialog.Title>
    <div class="messages">
        {#if loadError}<div class="error-message" role="alert">{describeFailure(loadError)}</div>{/if}
        <Dialog.Description class="description">{i18n.t("settings.loadFailure.description")}</Dialog.Description>
        {#if failure}<div class="error-message" role="alert">{describeFailure(failure)}</div>{/if}
    </div>
    {#snippet actions()}
        <TextButton disabled={busy} onclick={() => void recover(false)}>{i18n.t("common.retry")}</TextButton>
        <TextButton class="primary" disabled={busy} onclick={() => void recover(true)}>{i18n.t("settings.loadFailure.backupAndReset")}</TextButton>
    {/snippet}
</Modal>

<style>
    .messages {
        display: flex;
        flex-direction: column;
        gap: 12px;
        line-height: 1.6;
        user-select: text;
    }
    .messages :global(.description) {
        margin: 0;
        color: var(--c-text-80p);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
</style>

<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as settingsAPI from "../../states/settings";
    import { describeFailure } from "../../failures";
    import { type FailureInfo, toFailureInfo } from "../../../shared/failure";

    let { open = $bindable(), onClosed }: { open: boolean; onClosed: () => void } = $props();
    let busy = $state(false);
    let failure = $state<FailureInfo | null>(null);
    const loadError = $derived(settings.getSnapshot()?.loadError ?? null);

    $effect(() => {
        if (settings.getSnapshot()?.loadError === null) open = false;
    });

    async function recover(backup: boolean): Promise<void> {
        if (busy) return;
        busy = true;
        failure = null;
        try {
            const result = backup ? await settingsAPI.backupAndReset() : await settingsAPI.retryLoad();
            if (!result.success && (backup || !settings.getSnapshot()?.loadError)) failure = result.error;
        }
        catch (cause) {
            failure = toFailureInfo(cause);
        }
        finally {
            busy = false;
        }
    }
</script>