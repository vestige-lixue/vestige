<Modal
    bind:open
    class="save-confirmation"
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={isOpen => {
        if (!isOpen) answerSave(choice);
    }}
>
    <Dialog.Title class="modal-title">保存失败</Dialog.Title>
    <Dialog.Description class="modal-description">{`无法保存到“${saveConfirmation.fileName}”。\n${saveConfirmation.error}\n是否另存为其他文件？`}</Dialog.Description>
    {#snippet actions()}
        <button class="hoverable activable" onclick={() => choose("retry")}>重试</button>
        <button class="hoverable activable" onclick={() => choose("memory")}>在内存中编辑</button>
        <button class="save primary hoverable activable" onclick={() => choose("save")}>另存为…</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import { answerSave, saveConfirmation, type SaveChoice } from "../../states/confirmation.svelte";

    let open = $state(true);
    let choice: SaveChoice = "retry";

    function choose(value: SaveChoice): void {
        if (!open) return;
        choice = value;
        open = false;
    }
</script>