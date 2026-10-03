{#each dialog ? [dialog] : [] as current (current)}
    {#if current.kind === "vocabulary"}
        <Vocabulary bind:open={() => visible && current.open, open => current.open = open} onClosed={() => closed(current)} />
    {:else if current.kind === "tasks"}
        <TranscriptionTasks bind:open={() => visible && current.open, open => current.open = open} onClosed={next => closed(current, next)} />
    {:else if current.kind === "settings"}
        <Settings bind:open={() => visible && current.open, open => current.open = open} onClosed={() => closed(current)} />
    {:else if current.kind === "transcription"}
        <TranscriptionConfig bind:open={() => visible && current.open, open => current.open = open} item={current.item} onClosed={() => closed(current)} />
    {:else if current.kind === "failure"}
        <TranscriptionFailure bind:open={() => visible && current.open, open => current.open = open} item={current.item} onClosed={next => closed(current, next)} />
    {/if}
{/each}


<script lang="ts">
    import Vocabulary from "../dialogs/Vocabulary.svelte";
    import TranscriptionTasks from "../dialogs/TranscriptionTasks.svelte";
    import Settings from "../dialogs/Settings.svelte";
    import TranscriptionConfig from "../dialogs/TranscriptionConfig.svelte";
    import TranscriptionFailure from "../dialogs/TranscriptionFailure.svelte";
    import { interfaceState, type ApplicationDialog } from "../../states/interface.svelte";
    import { mediaImports } from "../../states/media.svelte";
    import { projectState } from "../../states/project.svelte";

    const dialog = $derived(interfaceState.dialog);
    const visible = $derived(!projectState.locked && projectState.error === null && mediaImports.issue === null);

    function closed(current: ApplicationDialog, next?: ApplicationDialog): void {
        if (!current.open && interfaceState.dialog === current) interfaceState.dialog = next ?? null;
    }
</script>