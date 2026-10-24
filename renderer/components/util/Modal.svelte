<Dialog.Root bind:open={() => visible, value => {
    if (!value) void requestClose();
}} onOpenChangeComplete={handleOpenChangeComplete}>
    <Dialog.Portal>
        <Dialog.Overlay class="modal-overlay" style={`z-index: ${layerIndex};`} onclick={() => {
            if (clickMaskBehavior === "close") void requestClose();
        }}>
            <div class="titlebar-backdrop"></div>
            <div class="content-backdrop"></div>
        </Dialog.Overlay>
        <Dialog.Content
            bind:ref={content}
            class={["modal-content", className]}
            style={`--modal-width: ${width}; --modal-height: ${height}; z-index: ${layerIndex + 1};`}
            escapeKeydownBehavior={escBehavior}
            interactOutsideBehavior="ignore"
            {onkeydown}
            onOpenAutoFocus={event => {
                event.preventDefault();
                returnFocus = document.activeElement;
                content?.focus();
                onOpenAutoFocus?.();
            }}
            onCloseAutoFocus={event => {
                event.preventDefault();
                const target = returnFocus;
                returnFocus = null;
                modal.restoreFocus(target);
            }}
        >
            <div class="body" bind:this={scrollElement}>
                {@render children()}
            </div>
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
        timeline-scope: --modal-scroll;
        position: fixed;
        top: calc(42% + env(titlebar-area-height) / 2);
        left: 50%;
        transform: translate(-50%, max(-50%, calc(-40vh + env(titlebar-area-height) / 2 + 24px)));
        width: var(--modal-width);
        max-width: calc(100vw - 48px);
        height: var(--modal-height);
        max-height: calc(100vh - env(titlebar-area-height) - 48px);
        overflow: clip;
        border: 1px solid var(--c-border);
        border-radius: 12px;
        color: var(--c-text);
        background: var(--bg);
        box-shadow: 0 8px 32px var(--c-shadow-3);
        display: flex;
        flex-flow: column nowrap;
    }
    .body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: clip;
        overflow-y: auto;
        scroll-timeline: --modal-scroll block;
        padding: 24px;
        display: flex;
        flex-flow: column nowrap;
        gap: 24px;
    }
    .body > :global(*) {
        flex-shrink: 0;
    }
    :global(.modal-content .modal-description) {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        color: var(--c-text);
        line-height: 1.6;
        user-select: text;
    }
    :global(.modal-content .actions) {
        --bg: var(--c-surface);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-shrink: 0;
        padding: 20px;
        margin-top: auto;
        border-top: 1px solid transparent;
        animation: actions-border auto step-end both;
        animation-timeline: --modal-scroll;
        font-size: 14px;
    }
    @keyframes actions-border {
        from { border-top-color: var(--c-border); }
        to { border-top-color: transparent; }
    }
    :global(.modal-content .actions .text-button) {
        padding: 8px 14px;
        background: var(--bg);
        border-color: var(--c-border-120p);
        font-size: inherit;
    }
    :global(.modal-content .actions .primary) {
        --bg: oklch(from var(--c-accent) max(l, 0.8) c h);
        color: var(--c-text);
    }
    :global(:root[data-theme="dark"] .modal-content .actions .primary) {
        --bg: oklch(from var(--c-accent) min(l, 0.45) c h);
    }
    :global(.modal-content .actions button:only-child) {
        margin-left: auto;
    }
</style>


<script lang="ts">
    import { getContext, onDestroy, untrack, type Snippet } from "svelte";
    import * as modal from "../../states/modal.svelte";
    import { Dialog } from "bits-ui";
    import { dialogLifecycleKey, type DialogLifecycle } from "../dialogs/lifecycle";

    type Props = {
        open: boolean;
        escBehavior: "close" | "ignore";
        clickMaskBehavior: "close" | "ignore";
        width?: string;
        height?: string;
        class?: string;
        scrollElement?: HTMLDivElement | null;
        children: Snippet;
        actions?: Snippet;
        onkeydown?: (event: KeyboardEvent) => void;
        onOpenAutoFocus?: () => void;
        beforeClose?: () => boolean | Promise<boolean>;
        // Clear content data or unmount the caller only after this reports false.
        onOpenChangeComplete?: (open: boolean) => void;
    };

    let {
        open = $bindable(),
        escBehavior,
        clickMaskBehavior,
        width = "440px",
        height = "auto",
        class: className = "",
        scrollElement = $bindable(null),
        children,
        actions,
        onkeydown,
        onOpenAutoFocus,
        beforeClose,
        onOpenChangeComplete
    }: Props = $props();

    let content = $state<HTMLDivElement | null>(null);
    let visible = $state(untrack(() => open));
    let phase: "open" | "checking" | "closing" | "closed" = untrack(() => open) ? "open" : "closed";
    let closeVersion = 0;
    let disposed = false;
    let returnFocus: Element | null = null;
    const lifecycle = getContext<DialogLifecycle | undefined>(dialogLifecycleKey);
    const layer = Symbol();
    const layerIndex = $derived(modal.getLayerIndex(layer));

    $effect.pre(() => {
        if (visible) untrack(() => modal.openLayer(layer));
    });
    $effect(() => {
        const requested = open;
        untrack(() => {
            if (requested) {
                if (phase !== "open") {
                    lifecycle?.closeRejected();
                    closeVersion++;
                    phase = "open";
                    visible = true;
                }
            }
            else if (phase === "open") void requestClose();
        });
    });
    onDestroy(() => {
        disposed = true;
        closeVersion++;
        modal.closeLayer(layer);
        lifecycle?.closeRejected();
    });

    async function requestClose(): Promise<void> {
        if (disposed || phase !== "open") return;
        phase = "checking";
        const version = ++closeVersion;
        try {
            // Read the current guard only for this request, never as an effect dependency.
            const accepted = await untrack(() => beforeClose?.());
            if (disposed || version !== closeVersion) return;
            if (accepted === false) {
                phase = "open";
                open = true;
                lifecycle?.closeRejected();
                return;
            }
            approveClose();
        }
        catch (error) {
            if (disposed || version !== closeVersion) return;
            phase = "open";
            open = true;
            lifecycle?.closeRejected();
            console.error("The dialog could not close.", error);
        }
    }

    // A domain editor may already have committed before choosing to close.
    export function approveClose(): void {
        if (disposed || phase === "closing" || phase === "closed") return;
        closeVersion++;
        phase = "closing";
        visible = false;
        open = false;
    }

    function handleOpenChangeComplete(isOpen: boolean): void {
        if (isOpen) {
            onOpenChangeComplete?.(true);
            return;
        }
        if (visible || open || phase !== "closing") return;
        phase = "closed";
        modal.closeLayer(layer);
        try {
            onOpenChangeComplete?.(false);
        }
        finally {
            // Application cleanup cannot depend on a business callback reaching onClosed.
            lifecycle?.closed();
        }
    }
</script>