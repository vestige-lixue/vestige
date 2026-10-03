<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={open => {
        if (!open) mediaImports.dismissImportFailure(failure);
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
    import { mediaImports, type MediaImportFailure } from "../../states/media.svelte";

    let { failure }: { failure: MediaImportFailure } = $props();
    let open = $state(true);
</script>