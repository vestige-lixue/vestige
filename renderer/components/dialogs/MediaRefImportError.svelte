<Modal
    bind:open
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={isOpen => {
        if (!isOpen) onClosed(action);
    }}
>
    <Dialog.Title class="modal-title">{labels[issue.status]}</Dialog.Title>
    <Dialog.Description class="modal-description">{description}</Dialog.Description>
    {#snippet actions()}
        <button class="hoverable activable" onclick={() => close(onRetry)}>重试</button>
        <button class="primary hoverable activable" onclick={() => close(onRelink)}>重新定位</button>
        <button class="hoverable activable" onclick={() => close(onIgnore)}>忽略</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import { type MediaIssueStatus } from "../../../shared/media/check";
    import * as dialogs from "../../states/dialogs.svelte";
    import * as project from "../../states/project.svelte";

    let { open = $bindable(), issue, onRetry, onRelink, onIgnore, onClosed }: {
        open: boolean;
        issue: dialogs.MediaRefImportIssue;
        onRetry: () => void;
        onRelink: () => void;
        onIgnore: () => void;
        onClosed: (next?: () => void) => void;
    } = $props();
    let action: (() => void) | undefined;

    const labels: Record<MediaIssueStatus, string> = {
        missing: "找不到媒体文件",
        changed: "媒体文件已变化",
        unreadable: "无法读取媒体文件"
    };

    function close(next: () => void): void {
        if (!open) return;
        action = next;
        open = false;
    }
    const description = $derived.by(() => {
        const { mediaId, path } = issue;
        const media = project.getMedia(mediaId);
        const original = !media || path === media.path ? "" : `\n项目原路径：${media.path}`;
        const guidance = issue.status === "changed"
            ? "请选择与原媒体内容相同的文件。要使用新内容，请另行导入。"
            : "可在外部恢复文件后重试，或重定位到文件的新位置。";
        return `${media?.name ?? ""}\n${path}${original}\n\n${issue.error}\n${guidance}\n忽略后保留此媒体及已有转写，也可在侧栏删除此媒体。`;
    });
</script>