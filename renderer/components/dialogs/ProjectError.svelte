<Modal
    bind:open
    escBehavior="close"
    clickMaskBehavior="ignore"
    class="project-dialog"
    onOpenChangeComplete={isOpen => {
        if (!isOpen) onClosed();
    }}
>
    <Dialog.Title class="modal-title">操作失败</Dialog.Title>
    <Dialog.Description class="modal-description">{message}</Dialog.Description>
    {#snippet actions()}
        <button class="primary hoverable activable" onclick={() => {
            open = false;
        }}>确定</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import * as dialogs from "../../states/dialogs.svelte";

    let { open = $bindable(), error, onClosed }: {
        open: boolean;
        error: dialogs.ProjectError;
        onClosed: () => void;
    } = $props();
    const message = $derived.by(() => {
        switch (error.kind) {
            case "pending-imports": return "仍有媒体尚未完成导入。请在侧栏点击删除按钮取消导入，或等待导入完成后再保存或关闭项目。";
            case "active-transcriptions": return "仍有转写任务正在运行或停止。请停止任务或等待完成后，再关闭或切换项目。";
            case "operation-failed": return error.diagnostic;
            case "read-failed": return `无法读取项目“${error.path}”。\n${error.diagnostic}`;
        }
    });
</script>