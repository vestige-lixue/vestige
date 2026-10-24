<Modal bind:open {beforeClose} width="750px" height="80%" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={value => {
    if (!value) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("settings.title")}</Dialog.Title>
    {#if mounted}
        <svelte:boundary>
            <SettingsContent {dialogId} bind:beforeClose />
            {#snippet pending()}
                <div>{i18n.t("settings.loading")}</div>
            {/snippet}
            {#snippet failed(error, reset)}
                <div class="error-message">{describeFailure(toFailureInfo(error))}</div>
                <TextButton class="settingsRetry" onclick={reset}>{i18n.t("common.retry")}</TextButton>
            {/snippet}
        </svelte:boundary>
    {/if}
</Modal>


<style>
    :global(.text-button.settingsRetry) {
        box-sizing: border-box;
        width: 50%;
        font-size: 16px;
        height: 32px;
        margin: 0 auto;
    }
</style>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import SettingsContent from "../settings/SettingsContent.svelte";
    import { toFailureInfo } from "../../../shared/failure";
    import { onMount, tick } from "svelte";

    let { open = $bindable(), dialogId, onClosed }: { open: boolean; dialogId: string; onClosed: () => void } = $props();
    let beforeClose = $state<() => Promise<boolean>>();
    let mounted = $state(false);

    onMount(() => {
        // Let Bits UI commit its dialog refs before starting the async boundary.
        void tick().then(() => mounted = true);
    });

</script>