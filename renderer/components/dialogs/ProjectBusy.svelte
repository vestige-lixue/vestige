<Modal bind:open escBehavior="ignore" clickMaskBehavior="ignore" class="project-dialog" onOpenChangeComplete={isOpen => {
    if (!isOpen) onClosed();
}}>
    <div class="heading">
        <Spinner size="20px" />
        <Dialog.Title class="modal-title">{title}</Dialog.Title>
    </div>
    <Dialog.Description class="modal-description">{detail}</Dialog.Description>
</Modal>


<style>
    .heading {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }
    .heading :global(.modal-title) {
        margin: 0;
    }
</style>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import Spinner from "../util/Spinner.svelte";
    import * as dialogs from "../../states/dialogs.svelte";

    let { open = $bindable(), operation, onClosed }: {
        open: boolean;
        operation: dialogs.ProjectOperation;
        onClosed: () => void;
    } = $props();

    const title = $derived.by(() => {
        switch (operation.kind) {
            case "new": return "正在新建项目";
            case "close": return "正在关闭项目";
            case "quit": return "正在退出应用";
            case "open": return "正在打开项目";
            case "read": return "正在读取并校验项目";
            case "save": return "正在保存项目";
            case "wait-save": return "正在等待项目保存";
        }
    });
    const detail = $derived.by(() => {
        switch (operation.kind) {
            case "new": case "close": case "quit": return "正在处理当前项目的更改";
            case "open": return operation.path ?? "正在选择项目文件";
            case "read": return operation.path;
            case "save": return operation.saveAs || operation.path === null ? "请选择保存位置" : operation.path;
            case "wait-save": return operation.fileName;
        }
    });
</script>