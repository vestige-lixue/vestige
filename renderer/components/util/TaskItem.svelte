<Accordion.Item {value} class={["task-item", className]}>
    <Accordion.Header class="task-item-heading">
        <Accordion.Trigger bind:ref class="task-item-trigger hoverable activable focusable" disabled={!expandable}>
            <span class="heading" style:padding-right={`${actions ? actionsWidth + 8 : 0}px`}>
                {#if expandable}
                    <span class="chevron">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html chevronRight}
                    </span>
                {/if}
                <span class="name">{@render title()}</span>
            </span>
            {#if status || typeof progress === "number"}
                <span class="status">
                    <span>{@render status?.()}</span>
                    {#if typeof progress === "number"}
                        <span>{Math.floor(Math.min(1, Math.max(0, progress)) * 100)}%</span>
                    {/if}
                </span>
            {/if}
            {#if progress !== undefined}
                <ProgressBar value={progress} height="6px" />
            {/if}
        </Accordion.Trigger>
    </Accordion.Header>
    {#if actions}
        <div class="task-item-actions" bind:clientWidth={actionsWidth}>
            {@render actions()}
        </div>
    {/if}
    <Accordion.Content class="task-item-output">
        {@render children?.()}
        <ConsoleOutput value={output} />
    </Accordion.Content>
</Accordion.Item>


<style>
    :global(.task-item) {
        --bg: color-mix(in srgb, var(--c-surface) 50%, var(--c-background));
        position: relative;
        min-width: 0;
        border-radius: 6px;
        background: var(--bg);
        --hover-lightness: 0.985;
        --active-lightness: 0.97;
    }
    :root[data-theme="dark"] :global(.task-item) {
        --bg: var(--c-surface);
    }
    :global(.task-item-heading) {
        margin: 0;
        font: inherit;
    }
    :global(.task-item-trigger) {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        padding: 10px 12px;
        border-radius: 6px;
        color: inherit;
        text-align: left;
        scroll-margin-top: 8px;
    }
    :global(.task-item-trigger:disabled) {
        opacity: 1;
    }
    :global(.task-item-trigger[data-state="open"]) {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
    }
    .heading {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
    }
    .name {
        min-width: 0;
        overflow-wrap: anywhere;
        font-weight: 600;
    }
    .chevron {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        width: 16px;
        height: 16px;
    }
    .chevron :global(svg) {
        width: 100%;
        height: 100%;
    }
    :global(.task-item-trigger[data-state="open"]) .chevron {
        transform: rotate(90deg);
    }
    .task-item-actions {
        position: absolute;
        top: 10px;
        right: 12px;
        display: flex;
        gap: 8px;
    }
    .task-item-actions :global(.text-button) {
        padding: 6px 12px;
        white-space: nowrap;
    }
    :global(.task-item .task-item-output textarea) {
        border-top-left-radius: 0;
        border-top-right-radius: 0;
    }
    .status {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: var(--c-text-80p);
        font-size: 14px;
        font-weight: normal;
    }
    :global(.task-item .task-item-message) {
        padding: 0 12px 8px;
        color: var(--c-text-80p);
        font-size: 13px;
    }
    :global(.task-item .task-item-error) {
        padding: 0 12px 10px;
        white-space: pre-wrap;
        user-select: text;
    }
</style>


<script lang="ts">
    import { type Snippet } from "svelte";
    import { Accordion } from "bits-ui";
    import ProgressBar from "./ProgressBar.svelte";
    import ConsoleOutput from "./ConsoleOutput.svelte";
    import chevronRight from "../../../resources/icons/carbon--chevron-right.svg?raw";

    type Props = {
        value: string;
        expandable?: boolean;
        // undefined hides progress; null shows indeterminate progress.
        progress?: number | null;
        output: string;
        class?: string;
        ref?: HTMLButtonElement | null;
        title: Snippet;
        status?: Snippet;
        actions?: Snippet;
        children?: Snippet;
    };

    let {
        value,
        expandable = true,
        progress,
        output,
        class: className = "",
        ref = $bindable(null),
        title,
        status,
        actions,
        children
    }: Props = $props();
    let actionsWidth = $state(0);
</script>