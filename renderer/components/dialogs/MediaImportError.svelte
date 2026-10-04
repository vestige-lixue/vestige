<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={open => {
        if (!open) onClosed();
    }}
>
    <Dialog.Title class="modal-title">媒体导入失败</Dialog.Title>
    <Dialog.Description class="modal-description">{`${failure.name}${failure.path ? `\n${failure.path}` : ""}\n\n${failure.error}\n请确认文件可读取且为支持的音视频格式。`}</Dialog.Description>
    {#snippet actions()}
        <button class="primary hoverable activable" onclick={() => {
            open = false;
        }}>确定</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";

    let { open = $bindable(), failure, onClosed }: {
        open: boolean;
        failure: mediaImport.MediaImportFailure;
        onClosed: () => void;
    } = $props();
</script>