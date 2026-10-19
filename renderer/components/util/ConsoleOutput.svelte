<textarea readonly bind:this={consoleElement} {value}
    onscroll={() => {
        if (consoleElement) following = consoleElement.scrollHeight - consoleElement.scrollTop - consoleElement.clientHeight < 24;
    }}></textarea>


<style>
    textarea {
        box-sizing: border-box;
        display: block;
        width: 100%;
        min-height: 140px;
        height: 180px;
        padding: 10px;
        resize: vertical;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        outline: none;
        background: var(--c-surface);
        color: var(--c-text);
        font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        scroll-behavior: auto;
        user-select: text;
    }
</style>


<script lang="ts">
    import { tick } from "svelte";

    let { value }: { value: string } = $props();
    let consoleElement: HTMLTextAreaElement | undefined;
    let following = true;

    $effect(() => {
        const text = value;
        void tick().then(() => {
            if (following && consoleElement?.isConnected && value === text) {
                consoleElement.scrollTop = consoleElement.scrollHeight;
            }
        });
    });
</script>