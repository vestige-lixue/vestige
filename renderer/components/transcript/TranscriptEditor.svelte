<div
    class="editor" spellcheck={settings.getEditing().spellcheck} style:font-size={`${settings.getEditing().fontSize}px`}
    tabindex={-1} bind:this={element}
></div>


<style>
    .editor {
        height: 100%;
    }
    .editor :global(.tiptap) {
        padding: 28px;
        min-height: 100%;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        cursor: text;
    }
    .editor :global(.tiptap), .editor :global(.tiptap *) {
        user-select: text;
        line-height: 1.8;
    }
    .editor :global(.token-prob-0) {
        color: color-mix(in srgb, var(--c-text) 40%, var(--c-background));
    }
    .editor :global(.token-prob-1) {
        color: color-mix(in srgb, var(--c-text) 55%, var(--c-background));
    }
    .editor :global(.token-prob-2) {
        color: color-mix(in srgb, var(--c-text) 70%, var(--c-background));
    }
    .editor :global(.token-prob-3) {
        color: color-mix(in srgb, var(--c-text) 85%, var(--c-background));
    }
    .editor :global(.token-prob-4) {
        color: var(--c-text);
    }
    .editor :global(.current) {
        outline: .125em solid var(--c-accent);
        outline-offset: .0625em;
    }
</style>


<script lang="ts">
    import { untrack } from "svelte";
    import { type Editor } from "@tiptap/core";
    import { Plugin } from "@tiptap/pm/state";
    import { type Vestige } from "../../../shared/Vestige";
    import { type Run } from "../../../shared/transcription/Run";
    import { createTranscriptEditor, setTranscriptPlayback } from "../../editor/transcript";
    import * as project from "../../states/project.svelte";
    import * as player from "../../states/player.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as projectAPI from "../../states/project";

    let { vestige, run }: { vestige: Vestige; run: Run } = $props();
    let element: HTMLDivElement;
    let editor = $state.raw<Editor>();

    $effect(() => {
        const current = vestige;
        const displayed = run;
        const instance = untrack(() => createTranscriptEditor(element, displayed, $state.snapshot(current.modifications), modifications => {
            if (project.getVestige(current.media.id) === current) projectAPI.updateModifications(current.media.id, displayed.id, modifications);
        }, () => !project.projectState.locked));
        instance.registerPlugin(new Plugin({
            props: {
                handleKeyDown(view, event) {
                    if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
                        || view.composing || !view.hasFocus()) return false;
                    event.stopPropagation();
                    element.focus({ preventScroll: true });
                    return true;
                }
            }
        }));
        editor = instance;
        return () => instance.destroy();
    });

    $effect(() => {
        editor?.setEditable(!project.projectState.locked, false);
    });

    $effect(() => {
        const current = editor;
        const time = player.getCurrentTime();
        if (current) untrack(() => setTranscriptPlayback(current, time));
    });
</script>