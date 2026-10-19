{#if item}
    <div class="media hoverable focusable" class:selected={mediaSelection.get() === mediaId} class:ignored={issue?.ignored} bind:this={mediaElement}
        tabindex={tabStop === 0 ? 0 : -1}
        onfocus={event => {
            if (event.target === event.currentTarget) focusedTarget = 0;
        }}
        onfocusout={event => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) focusedTarget = 0;
        }}
        onclick={() => {
            if (!project.projectState.locked) runCommand({ kind: "selectMedia", mediaId });
        }}
        onkeydown={handleKeydown}
    >
        <Tooltip text={i18n.t("media.renameHint")} disabled={project.projectState.locked}
            tabindex={tabStop === 1 ? 0 : -1} onfocus={() => focusedTarget = 1}
        >
            {#snippet child({ props })}
                <NiceLabel
                    {...props}
                    value={mediaImport.getName(mediaId)}
                    editable={!project.projectState.locked}
                    onchange={name => runCommand({ kind: "renameMedia", mediaId, name })}
                    scrollMode="ontime"
                    scrollParam={1.5}
                    scrollPause={0.5}
                />
            {/snippet}
        </Tooltip>
        <div class="media-secondary-wrapper">
            <div class="media-info">
                {#if vestige}
                    {i18n.t("media.summary", { kind: i18n.t(vestige.media.kind === "audio" ? "media.types.audio" : "media.types.video"), duration: getSemanticDuration(vestige.media.duration) })}
                {/if}
                {#if mediaImport.isIssue(item)}
                    <button class="media-issue import-error focusable" disabled={project.projectState.locked}
                        tabindex={tabStop === 2 ? 0 : -1} onfocus={() => focusedTarget = 2}
                        onclick={() => runCommand({ kind: "reviewMediaImportError", mediaId })}
                    >
                        {item.ignored ? i18n.t("media.reference.ignored", { status: issueLabels[item.stage] }) : issueLabels[item.stage]}
                    </button>
                {:else if item.stage !== "ready"}
                    <span class="import-progress">
                        <Spinner size="12px" />
                        {importStages[item.stage]}
                    </span>
                {/if}
                {#if task?.status === "queued"}<span>{i18n.t("media.queuedTranscription")}</span>{/if}
            </div>
            <div class="media-actions">
                <MediaRuns {mediaId} anchor={mediaElement} disabled={!vestige || project.projectState.locked}
                    tabindex={tabStop === 3 ? 0 : -1} onfocus={() => focusedTarget = 3} />
                <Tooltip
                    text={i18n.t(transcriptionCommand.kind === "openTranscriptionConfig" ? "transcription.actions.new" : "transcription.tasks.title")}
                    shortcut={transcriptionCommand.kind === "openTranscriptionConfig" ? `${modKeyText}+B` : `${modKeyText}+T`}
                    disabled={commandDisabled(transcriptionCommand)}
                    tabindex={tabStop === 4 ? 0 : -1}
                    onfocus={() => focusedTarget = 4}
                    onclick={() => runCommand(transcriptionCommand)}
                >
                    {#snippet child({ props })}
                        <button {...props} class="icon-button hoverable activable focusable" class:translate={!hasActiveTask} class:danger={task?.status === "failed"}>
                            {#if hasActiveTask}
                                <Spinner />
                            {:else}
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html task?.status === "failed" ? taskRemoveIcon : taskAddIcon}
                            {/if}
                        </button>
                    {/snippet}
                </Tooltip>
                <ConfirmDeleteButton
                    text={vestige ? i18n.t("media.actions.remove") : i18n.t("media.import.actions.cancel")}
                    disabled={project.projectState.locked} resetKey={item.stage}
                    tabindex={tabStop === 5 ? 0 : -1} onfocus={() => focusedTarget = 5}
                    onconfirm={() => runCommand({ kind: "removeMedia", mediaId })}
                />
            </div>
        </div>
    </div>
{/if}


<style>
    .media {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px;
        border-radius: 8px;
        --bg: var(--c-background);
        background: var(--bg);
        cursor: pointer;
    }
    .media.hoverable:active:not(:has(:global(:active))) {
        background-color: hsl(from var(--bg) h s calc(l * var(--active-lightness)));
    }
    :root[data-theme="dark"] .media.hoverable:active:not(:has(:global(:active))) {
        background-color: hsl(from var(--bg) h s calc(100 - (100 - l) * var(--active-lightness)));
    }
    .media.selected :global(*)::selection {
        background-color: hsl(from var(--c-selection) h s calc(l * 0.85));
    }
    :where(.media *) {
        cursor: default;
        --hover-lightness: 0.94;
        --active-lightness: 0.88;
    }
    .media.selected {
        --bg: var(--c-selection-bg);
    }
    .media.ignored {
        --bg: color-mix(in srgb, var(--c-danger) 20%, var(--c-background));
    }
    .media.selected.ignored {
        --bg: color-mix(in srgb, var(--c-danger) 30%, var(--c-selection-bg));
    }
    .media-secondary-wrapper {
        display: flex;
        flex-flow: row nowrap;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        min-height: 1.1lh;
        pointer-events: none;
    }
    :where(.media-secondary-wrapper > *) {
        pointer-events: auto;
    }
    .media-info {
        color: var(--c-text-80p);
        font-size: 13px;
        display: flex;
        flex-flow: column nowrap;
        align-items: flex-start;
        word-wrap: break-word;
        word-break: break-all;
        gap: 4px;
        min-width: 0;
    }
    .media-actions {
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        gap: 4px;
    }
    .import-progress {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .import-error {
        overflow: hidden;
    }
    .icon-button {
        height: 18px;
        width: 18px;
        flex-shrink: 0;
    }
    .media-actions :global(button) {
        --hover-lightness: 0.92;
        --active-lightness: 0.88;
    }
    :root[data-theme="dark"] .media-actions :global(button) {
        --hover-lightness: 0.9;
        --active-lightness: 0.94;
    }
    button.media-issue {
        padding: 0;
        display: block;
        width: auto;
        min-width: 0;
        max-width: 100%;
        height: auto;
        text-align: left;
        color: inherit;
        border-radius: 4px;
        flex-shrink: 0;
    }
    button:disabled {
        opacity: 0.4;
    }
    button:focus-visible {
        border-radius: 4px;
    }
    .translate :global(svg) {
        transform: translateX(-1px);
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as project from "../../states/project.svelte";
    import * as transcription from "../../states/transcription.svelte";
    import { commandDisabled, runCommand, type Command } from "../../states/commands";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import Spinner from "../util/Spinner.svelte";
    import NiceLabel from "../util/NiceLabel.svelte";
    import MediaRuns from "./MediaRuns.svelte";
    import taskAddIcon from "../../../resources/icons/carbon--task-add.svg?raw";
    import taskRemoveIcon from "../../../resources/icons/carbon--task-remove.svg?raw";
    import ConfirmDeleteButton from "../util/ConfirmDeleteButton.svelte";
    import Tooltip from "../util/Tooltip.svelte";

    const modKeyText = window.api.platform === "darwin" ? "⌘" : "Ctrl";
    const { mediaId }: { mediaId: string } = $props();
    const item = $derived(mediaImport.get(mediaId));
    const issue = $derived(item && mediaImport.isIssue(item) ? item : null);
    const vestige = $derived(project.getVestige(mediaId));
    const task = $derived(transcription.getTask(mediaId));
    const hasActiveTask = $derived(transcription.isPending(task));
    const transcriptionCommand = $derived<Command>({
        kind: hasActiveTask || task?.status === "failed" ? "openTranscriptionTask" : "openTranscriptionConfig",
        mediaId
    });
    let mediaElement = $state<HTMLDivElement | null>(null);
    let focusedTarget = $state(0);
    const targetDisabled = $derived([
        false,
        project.projectState.locked,
        !issue || project.projectState.locked,
        !vestige || project.projectState.locked,
        commandDisabled(transcriptionCommand),
        project.projectState.locked
    ]);
    const tabStop = $derived(targetDisabled[focusedTarget] ? 0 : focusedTarget);

    const importStages = $derived({
        queued: i18n.t("media.import.status.queued"),
        path: i18n.t("media.import.status.path"),
        reading: i18n.t("media.import.status.reading"),
        relocating: i18n.t("media.import.status.relocating")
    });
    const issueLabels = $derived({
        missing: i18n.t("media.reference.status.missing"),
        changed: i18n.t("media.reference.status.changed"),
        unreadable: i18n.t("media.reference.status.unreadable")
    });

    function handleKeydown(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.isComposing) return;
        if (!(event.currentTarget instanceof HTMLDivElement) || !(event.target instanceof HTMLElement) || event.target.isContentEditable) return;
        if (event.target === event.currentTarget && event.key === "Enter") {
            event.preventDefault();
            if (!project.projectState.locked) runCommand({ kind: "selectMedia", mediaId });
            return;
        }
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const targets = [event.currentTarget, ...event.currentTarget.querySelectorAll<HTMLElement>("[tabindex]:not(:disabled):not([data-disabled])")];
        const index = targets.indexOf(event.target);
        if (index < 0) return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        targets[(index + direction + targets.length) % targets.length]?.focus();
    }

    function getSemanticDuration(duration: number): string {
        if (duration < 60)
            return `00:${Math.round(duration).toString().padStart(2, "0")}`;
        else if (duration < 3600)
            return `${Math.floor(duration / 60).toString().padStart(2, "0")}:${Math.round(duration % 60).toString().padStart(2, "0")}`;
        else
            return `${Math.floor(duration / 3600)}:${Math.floor((duration % 3600) / 60).toString().padStart(2, "0")}:${Math.round(duration % 60).toString().padStart(2, "0")}`;
    }
</script>