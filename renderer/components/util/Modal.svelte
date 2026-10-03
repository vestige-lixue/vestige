<Dialog.Root bind:open onOpenChangeComplete={handleOpenChangeComplete}>
    <Dialog.Portal>
        <Dialog.Overlay class="modal-overlay" style={`z-index: ${layerIndex};`}>
            <div class="titlebar-backdrop"></div>
            <div class="content-backdrop"></div>
        </Dialog.Overlay>
        <Dialog.Content
            bind:ref={content}
            class={["modal-content", className]}
            style={`--modal-width: ${width}; --modal-height: ${height}; z-index: ${layerIndex + 1};`}
            escapeKeydownBehavior={escBehavior}
            interactOutsideBehavior={clickMaskBehavior}
            onOpenAutoFocus={event => {
                event.preventDefault();
                content?.focus();
            }}
        >
            {@render children?.()}
            {#if actions}
                <div class="actions">
                    {@render actions()}
                </div>
            {/if}
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>


<style>
    :global(.modal-overlay), :global(.modal-content) {
        opacity: 1;
        transition: opacity .16s ease-out;
    }
    @starting-style {
        :global(.modal-overlay), :global(.modal-content) {
            opacity: 0;
        }
    }
    :global(.modal-overlay[data-starting-style]),
    :global(.modal-overlay[data-ending-style]),
    :global(.modal-content[data-starting-style]),
    :global(.modal-content[data-ending-style]) {
        opacity: 0;
    }
    :global(.modal-overlay[data-ending-style]),
    :global(.modal-content[data-ending-style]) {
        transition-timing-function: ease-in;
    }
    @media (prefers-reduced-motion: reduce) {
        :global(.modal-overlay), :global(.modal-content) {
            transition: none;
        }
    }
    :global(.modal-overlay) {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
    }
    .titlebar-backdrop, .content-backdrop {
        background: var(--c-overlay);
        pointer-events: auto;
    }
    .titlebar-backdrop {
        height: env(titlebar-area-height);
        flex-shrink: 0;
        -webkit-app-region: drag;
    }
    .content-backdrop {
        flex: 1;
        min-height: 0;
        -webkit-app-region: no-drag;
    }
    :global(.modal-content) {
        --bg: var(--c-background);
        position: fixed;
        top: calc(40% + env(titlebar-area-height) / 2);
        left: 50%;
        transform: translate(-50%, max(-50%, calc(-40vh + env(titlebar-area-height) / 2 + 24px)));
        width: var(--modal-width);
        max-width: calc(100vw - 48px);
        height: var(--modal-height);
        max-height: calc(100vh - env(titlebar-area-height) - 48px);
        overflow: auto;
        padding: 24px;
        border: 1px solid var(--c-border);
        border-radius: 12px;
        color: var(--c-text);
        background: var(--bg);
        box-shadow: 0 8px 32px var(--c-shadow-3);
    }
    :global(.modal-content .modal-title) {
        margin: 0 0 12px;
        font-size: 18px;
        font-weight: bold;
    }
    :global(.modal-content .modal-description) {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        color: var(--c-muted);
        line-height: 1.6;
        user-select: text;
    }
    .actions {
        --bg: var(--c-surface);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 24px;
    }
    .actions :global(button) {
        padding: 8px 14px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        background: var(--bg);
    }
    .actions :global(.primary) {
        --bg: var(--c-accent);
        color: var(--c-background);
    }
</style>


<script lang="ts">
    import { onDestroy, untrack, type Snippet } from "svelte";
    import { modalLayers } from "../../states/modal.svelte";
    import { Dialog } from "bits-ui";

    type Props = {
        open?: boolean;
        escBehavior: "close" | "ignore";
        clickMaskBehavior: "close" | "ignore";
        width?: string;
        height?: string;
        class?: string;
        children?: Snippet;
        actions?: Snippet;
        // Clear content data or unmount the caller only after this reports false.
        onOpenChangeComplete?: (open: boolean) => void;
    };

    let {
        open = $bindable(false),
        escBehavior,
        clickMaskBehavior,
        width = "440px",
        height = "auto",
        class: className = "",
        children,
        actions,
        onOpenChangeComplete
    }: Props = $props();

    let content = $state<HTMLDivElement | null>(null);
    const layer = Symbol();
    const layerIndex = $derived(modalLayers.index(layer));

    $effect.pre(() => {
        if (open) untrack(() => modalLayers.open(layer));
    });
    onDestroy(() => modalLayers.close(layer));

    function handleOpenChangeComplete(isOpen: boolean): void {
        if (!isOpen && !open) {
            modalLayers.close(layer);
        }
        onOpenChangeComplete?.(isOpen);
    }
</script>