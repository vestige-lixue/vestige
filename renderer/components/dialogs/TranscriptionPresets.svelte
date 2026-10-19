<Modal bind:open={() => visible, value => {
    if (!value) void close();
}} class="transcription-presets" width="800px" height="85%" escBehavior="close" clickMaskBehavior="close"
    onOpenChangeComplete={value => {
        if (!value && !visible) onClosed();
    }}>
    <Dialog.Title class="modal-title">{i18n.t("transcription.presets.title")}</Dialog.Title>
    {#if mounted}
        <svelte:boundary>
            <PresetsEditor {dialogId} {selectedName} onApply={onApply ? (name, config) => {
                onApply(name, config);
                visible = false;
                open = false;
            } : undefined} bind:beforeClose />
            {#snippet pending()}<div>{i18n.t("transcription.presets.loading")}</div>{/snippet}
            {#snippet failed(error, reset)}
                <div class="error-message">{describeFailure(toFailureInfo(error))}</div>
                <TextButton onclick={reset}>{i18n.t("common.retry")}</TextButton>
            {/snippet}
        </svelte:boundary>
    {/if}
</Modal>


<style>
    :global(.modal-content.transcription-presets > .body) {
        overflow: clip;
    }
</style>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import { onMount, tick } from "svelte";
    import { Dialog } from "bits-ui";
    import * as i18n from "../../i18n.svelte";
    import { type Config } from "../../../shared/transcription/Config";
    import { toFailureInfo } from "../../../shared/failure";
    import { describeFailure } from "../../failures";
    import Modal from "../util/Modal.svelte";
    import PresetsEditor from "../transcription/PresetsEditor.svelte";

    type Props = { open: boolean; dialogId: string; selectedName?: string; onApply?: (name: string, config: Config) => void; onClosed: () => void };
    let { open = $bindable(), dialogId, selectedName, onApply, onClosed }: Props = $props();
    // Programmatic parent closure must not leave an orphan editor behind.
    let visible = $derived(open);
    let mounted = $state(false);
    let beforeClose = $state<() => Promise<boolean>>();
    let closing = false;

    onMount(() => {
        void tick().then(() => mounted = true);
    });

    async function close(): Promise<void> {
        if (closing || !visible) return;
        closing = true;
        try {
            if (await beforeClose?.() !== false) {
                visible = false;
                open = false;
            }
        }
        finally {
            closing = false;
        }
    }
</script>