{#each dialogs.state.dialogs as current (current.id)}
    {#if current.kind === "transcription-backends"}
        <TranscriptionBackends bind:open={current.open} dialogId={current.id} onClosed={() => closed(current)} />
    {:else if current.kind === "transcription-models"}
        <TranscriptionModels bind:open={current.open} dialogId={current.id} onClosed={() => closed(current)} />
    {:else if current.kind === "vocabulary"}
        <Vocabulary bind:open={current.open} onClosed={() => closed(current)} />
    {:else if current.kind === "settings"}
        <Settings bind:open={current.open} dialogId={current.id} onClosed={() => closed(current)} />
    {:else if current.kind === "guide"}
        <UserGuide bind:open={current.open} onClosed={() => closed(current)} />
    {:else if current.kind === "parameter-guide"}
        <ParameterGuide bind:open={current.open} onClosed={() => closed(current)} />
    {:else if current.kind === "licenses"}
        <OpenSourceLicenses bind:open={current.open} onClosed={() => closed(current)} />
    {:else if current.kind === "about"}
        <About bind:open={current.open} onClosed={() => closed(current)} />
    {:else if current.kind === "tasks"}
        <TranscriptionTasks bind:open={current.open} tasks={current.getTasks()} focusTaskId={current.focusTaskId} onStop={current.onStop} onRetry={current.onRetry} onRemove={current.onRemove} onClosed={next => closed(current, next)} />
    {:else if current.kind === "transcription"}
        <TranscriptionConfig bind:open={current.open} dialogId={current.id} mediaId={current.mediaId} taskId={current.taskId} onClosed={() => closed(current)} />
    {:else if current.kind === "switch-displayed-run"}
        <SwitchDisplayedRun bind:open={current.open} onConfirm={current.onConfirm} onClosed={() => closed(current)} />
    {:else if current.kind === "transcription-presets"}
        <TranscriptionPresets bind:open={current.open} dialogId={current.id} selectedName={current.selectedName} onApply={current.onApply} onClosed={() => closed(current)} />
    {:else if current.kind === "save-confirmation"}
        <SaveConfirmation bind:open={current.open} fileName={current.fileName} answer={current.answer} onClosed={() => closed(current)} />
    {:else if current.kind === "save-failure"}
        <SaveFailure bind:open={current.open} fileName={current.fileName} error={current.error} answer={current.answer} onClosed={() => closed(current)} />
    {:else if current.kind === "project-busy"}
        <ProjectBusy bind:open={current.open} operation={current.getOperation()} onClosed={() => closed(current)} />
    {:else if current.kind === "project-error"}
        <ProjectError bind:open={current.open} error={current.error} onClosed={() => closed(current)} />
    {:else if current.kind === "media-import-error"}
        <MediaImportError bind:open={current.open} failure={current.failure} onClosed={() => closed(current)} />
    {:else if current.kind === "media-ref-import-error"}
        <MediaRefImportError bind:open={current.open} issue={current.issue} onRetry={current.onRetry} onRelink={current.onRelink} onIgnore={current.onIgnore} onClosed={next => closed(current, next)} />
    {/if}
{/each}


<script lang="ts">
    import { untrack } from "svelte";
    import TranscriptionBackends from "../dialogs/TranscriptionBackends.svelte";
    import TranscriptionModels from "../dialogs/TranscriptionModels.svelte";
    import Vocabulary from "../dialogs/Vocabulary.svelte";
    import TranscriptionTasks from "../dialogs/TranscriptionTasks.svelte";
    import Settings from "../dialogs/Settings.svelte";
    import OpenSourceLicenses from "../dialogs/OpenSourceLicenses.svelte";
    import About from "../dialogs/About.svelte";
    import UserGuide from "../dialogs/UserGuide.svelte";
    import ParameterGuide from "../dialogs/ParameterGuide.svelte";
    import TranscriptionConfig from "../dialogs/TranscriptionConfig.svelte";
    import SwitchDisplayedRun from "../dialogs/SwitchDisplayedRun.svelte";
    import TranscriptionPresets from "../dialogs/TranscriptionPresets.svelte";
    import SaveConfirmation from "../dialogs/SaveConfirmation.svelte";
    import SaveFailure from "../dialogs/SaveFailure.svelte";
    import ProjectBusy from "../dialogs/ProjectBusy.svelte";
    import ProjectError from "../dialogs/ProjectError.svelte";
    import MediaImportError from "../dialogs/MediaImportError.svelte";
    import MediaRefImportError from "../dialogs/MediaRefImportError.svelte";
    import * as dialogs from "../../states/dialogs.svelte";
    import * as dialogsAPI from "../../states/dialogs";

    const presented = new WeakSet<dialogs.ApplicationDialog>();
    $effect(() => {
        for (const current of [...dialogs.state.dialogs]) {
            if (current.parentId && !dialogs.state.dialogs.some(parent => parent.id === current.parentId)) {
                untrack(() => dialogsAPI.close(current.id));
            }
            if (current.open) presented.add(current);
            // A dialog closed before its first render has no closing animation to report.
            else if (!presented.has(current)) untrack(() => closed(current));
        }
    });

    function closed(current: dialogs.ApplicationDialog, next?: () => void): void {
        if (current.open || !dialogs.state.dialogs.includes(current)) return;
        dialogsAPI.remove(current.id);
        current.onClosed();
        next?.();
    }
</script>