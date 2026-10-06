{#if item}
    <div class="media hoverable focusable" class:selected={mediaSelection.get() === mediaId} class:ignored={issue?.ignored}
        role="button" tabindex={tabStop === 0 ? 0 : -1}
        onfocus={event => {
            if (event.target === event.currentTarget) focusedTarget = 0;
        }}
        onclick={() => {
            if (!project.projectState.locked) runCommand({ kind: "selectMedia", mediaId });
        }}
        onkeydown={handleKeydown}
    >
        <Tooltip text={i18n.t("media.rename")} disabled={project.projectState.locked}
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
            <div class="media-info" title={issue ? describeFailure(issue.error) : undefined}>
                {#if vestige}
                    {i18n.t("media.summary", { kind: i18n.t(vestige.media.kind === "audio" ? "media.audio" : "media.video"), duration: getSemanticDuration(vestige.media.duration) })}
                {/if}
                {#if mediaImport.isIssue(item)}
                    <button class="media-issue import-error focusable" disabled={project.projectState.locked}
                        tabindex={tabStop === 2 ? 0 : -1} onfocus={() => focusedTarget = 2}
                        onclick={() => runCommand({ kind: "reviewMediaImportError", mediaId })}
                    >
                        {item.ignored ? i18n.t("media.ignored", { status: issueLabels[item.stage] }) : issueLabels[item.stage]}
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
                <Tooltip
                    text={transcriptionLabel(transcription.getAction(mediaId))}
                    shortcut={`${modKeyText}+B`}
                    disabled={commandDisabled(transcriptionCommand)}
                    tabindex={tabStop === 3 ? 0 : -1}
                    onfocus={() => focusedTarget = 3}
                    onclick={() => runCommand(transcriptionCommand)}
                >
                    {#snippet child({ props })}
                        <button {...props} class="hoverable activable focusable translate">
                            {#if task && task.status !== "failed"}
                                <Spinner />
                            {:else}
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html task?.status === "failed" ? taskRemoveIcon : vestige?.runs.length ? taskCompleteIcon : taskAddIcon}
                            {/if}
                        </button>
                    {/snippet}
                </Tooltip>
                <Tooltip
                    text={confirmingRemove ? i18n.t("common.confirmAgain") : vestige ? i18n.t("media.remove") : i18n.t("media.cancelImport")}
                    bind:open={removeTooltipOpen}
                    disableCloseOnTriggerClick
                    disabled={project.projectState.locked}
                    tabindex={tabStop === 4 ? 0 : -1}
                    onfocus={() => focusedTarget = 4}
                    onclick={handleRemove}
                >
                    {#snippet child({ props })}
                        <button {...props} class="hoverable activable focusable danger" bind:this={removeButton}>
                            {#if confirmingRemove}
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html checkIcon}
                            {:else}
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html removeIcon}
                            {/if}
                        </button>
                    {/snippet}
                </Tooltip>
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
        --hover-lightness: 0.98;
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
        --bg: color-mix(in srgb, var(--c-danger) 12%, var(--c-background));
    }
    .media.selected.ignored {
        --bg: color-mix(in srgb, var(--c-danger) 12%, var(--c-selection-bg));
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
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    button {
        display: grid;
        place-items: center;
        height: 18px;
        width: 18px;
        padding: 4px;
        border-radius: 4px;
        flex-shrink: 0;
    }
    button.media-issue {
        display: block;
        width: auto;
        min-width: 0;
        max-width: 100%;
        height: auto;
        text-align: left;
        color: inherit;
    }
    button:disabled {
        opacity: 0.4;
    }
    button:focus-visible {
        border-radius: 4px;
    }
    button :global(svg) {
        display: block;
        height: 100%;
        width: 100%;
        pointer-events: none;
    }
    .translate :global(svg) {
        transform: translateX(-1px);
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { describeFailure, transcriptionLabel } from "../feedback";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as project from "../../states/project.svelte";
    import * as transcription from "../../states/transcription.svelte";
    import { commandDisabled, runCommand, type Command } from "../../states/commands";
    import * as mediaSelection from "../../states/mediaSelection.svelte";
    import Spinner from "../util/Spinner.svelte";
    import NiceLabel from "../util/NiceLabel.svelte";
    import taskAddIcon from "../../../resources/icons/carbon--task-add.svg?raw";
    import taskCompleteIcon from "../../../resources/icons/carbon--task-complete.svg?raw";
    import taskRemoveIcon from "../../../resources/icons/carbon--task-remove.svg?raw";
    import removeIcon from "../../../resources/icons/carbon--trash-can.svg?raw";
    import checkIcon from "../../../resources/icons/carbon--checkmark.svg?raw";
    import Tooltip from "../util/Tooltip.svelte";

    const modKeyText = window.api.platform === "darwin" ? "⌘" : "Ctrl";
    const { mediaId }: { mediaId: string } = $props();
    const item = $derived(mediaImport.get(mediaId));
    const issue = $derived(item && mediaImport.isIssue(item) ? item : null);
    const vestige = $derived(project.getVestige(mediaId));
    const task = $derived(transcription.getTask(mediaId));
    const transcriptionCommand = $derived<Command>({
        kind: task?.status === "failed" ? "reviewTranscriptionError" : task ? "stopTranscription" : "openTranscriptionConfig",
        mediaId
    });
    let confirmingRemove = $state(false);
    let removeTooltipOpen = $state(false);
    let removeButton = $state<HTMLButtonElement>();
    let focusedTarget = $state(0);
    const targetDisabled = $derived([
        false,
        project.projectState.locked,
        !issue || project.projectState.locked,
        commandDisabled(transcriptionCommand),
        project.projectState.locked
    ]);
    const tabStop = $derived(targetDisabled[focusedTarget] ? 0 : focusedTarget);

    const importStages = $derived({
        queued: i18n.t("media.importStage.queued"),
        path: i18n.t("media.importStage.path"),
        reading: i18n.t("media.importStage.reading"),
        relocating: i18n.t("media.importStage.relocating")
    });
    const issueLabels = $derived({
        missing: i18n.t("media.issue.missing"),
        changed: i18n.t("media.issue.changed"),
        unreadable: i18n.t("media.issue.unreadable")
    });

    $effect(() => {
        const locked = project.projectState.locked;
        if (item?.stage === "ready" || locked) {
            confirmingRemove = false;
            removeTooltipOpen = false;
        }
    });

    $effect(() => {
        if (!confirmingRemove) return;
        const reset = (event: Event): void => {
            if (!removeButton || !event.composedPath().includes(removeButton)) confirmingRemove = false;
        };
        window.addEventListener("pointerdown", reset, true);
        window.addEventListener("click", reset, true);
        return () => {
            window.removeEventListener("pointerdown", reset, true);
            window.removeEventListener("click", reset, true);
        };
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

    function handleRemove(event: MouseEvent): void {
        event.stopPropagation();
        if (project.projectState.locked) return;
        if (confirmingRemove) runCommand({ kind: "removeMedia", mediaId });
        else {
            confirmingRemove = true;
            removeTooltipOpen = true;
        }
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