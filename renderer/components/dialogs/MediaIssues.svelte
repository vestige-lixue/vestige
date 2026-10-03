<Modal
    bind:open={() => open && !projectState.locked && projectState.error === null && !mediaImports.selecting, value => open = value}
    escBehavior="ignore"
    clickMaskBehavior="ignore"
    onOpenChangeComplete={isOpen => {
        if (!isOpen && !open) action?.();
    }}
>
    <Dialog.Title class="modal-title">{isMediaIssue(issue.stage) ? mediaIssueLabels[issue.stage] : "媒体文件异常"}</Dialog.Title>
    <Dialog.Description class="modal-description">{description}</Dialog.Description>
    {#snippet actions()}
        <button class="hoverable activable" onclick={() => close(() => retryMedia(issue))}>重试</button>
        <button class="primary hoverable activable" onclick={() => close(() => relinkMedia(issue))}>重新定位</button>
        <button class="hoverable activable" onclick={() => close(() => ignoreMedia(issue))}>忽略</button>
    {/snippet}
</Modal>


<script lang="ts">
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import { mediaImports, isMediaIssue, mediaIssueLabels, type MediaItemState } from "../../states/media.svelte";
    import { projectState, retryMedia, relinkMedia, ignoreMedia } from "../../states/project.svelte";

    const { issue }: { issue: MediaItemState } = $props();
    let open = $state(true);
    let action: (() => void) | undefined;

    function close(next: () => void): void {
        if (!open) return;
        action = next;
        open = false;
    }
    const description = $derived.by(() => {
        if (!issue.vestige) return "";
        const media = issue.vestige.media;
        const path = issue.checkedPath ?? media.path;
        const original = path === media.path ? "" : `\n项目原路径：${media.path}`;
        const guidance = issue.stage === "changed"
            ? "请选择与原媒体内容相同的文件。要使用新内容，请另行导入。"
            : "可在外部恢复文件后重试，或重定位到文件的新位置。";
        return `${media.name}\n${path}${original}\n\n${issue.error ?? ""}\n${guidance}\n忽略后保留此媒体及已有转写，也可在侧栏删除此媒体。`;
    });
</script>