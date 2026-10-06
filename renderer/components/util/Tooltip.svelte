<Tooltip.Root bind:open={() => open, value => {
    if (value && modal.isRestoringFocus(ref)) return;
    open = value;
}} {disableCloseOnTriggerClick}>
    <Tooltip.Trigger {...triggerProps} bind:ref />
    <Tooltip.Portal>
        <Tooltip.Content class="tooltip-content" style={`z-index: ${modal.getTopLayer()};`} {side} sideOffset={6} collisionPadding={8}>
            <div>
                {#if typeof text === "string"}{text}{:else}{@render text()}{/if}
            </div>
            {#if shortcut}<kbd>{shortcut}</kbd>{/if}
        </Tooltip.Content>
    </Tooltip.Portal>
</Tooltip.Root>


<style>
    :global(.tooltip-content) {
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        gap: 8px;
        max-width: min(320px, calc(100vw - 16px));
        padding: 6px 8px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        color: var(--c-text);
        background: var(--c-surface);
        box-shadow: 0 4px 12px var(--c-shadow-3);
        font-size: 13px;
        line-height: 1.5;
        overflow-wrap: anywhere;
        transform-origin: var(--bits-tooltip-content-transform-origin);
        opacity: 1;
        transform: translate(0, 0) scale(1);
        transition: opacity .16s ease-out, transform .16s ease-out;
    }
    :global(.tooltip-content kbd) {
        flex-shrink: 0;
        white-space: nowrap;
    }
    :global(.tooltip-content[data-side="top"]) {
        --tooltip-offset-y: 6px;
    }
    :global(.tooltip-content[data-side="bottom"]) {
        --tooltip-offset-y: -6px;
    }
    :global(.tooltip-content[data-side="left"]) {
        --tooltip-offset-x: 6px;
    }
    :global(.tooltip-content[data-side="right"]) {
        --tooltip-offset-x: -6px;
    }
    :global(.tooltip-content[data-starting-style]),
    :global(.tooltip-content[data-ending-style]) {
        opacity: 0;
        transform: translate(var(--tooltip-offset-x, 0px), var(--tooltip-offset-y, 0px)) scale(.5);
    }
    :global(.tooltip-content[data-ending-style]) {
        transition-timing-function: ease-in;
        pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
        :global(.tooltip-content) {
            transition: none;
        }
    }
</style>


<script lang="ts">
    import { type Snippet } from "svelte";
    import { Tooltip } from "bits-ui";
    import * as modal from "../../states/modal.svelte";
    type Props = Tooltip.TriggerProps & {
        text: string | Snippet;
        shortcut?: string;
        side?: Tooltip.ContentProps["side"];
        open?: boolean;
        disableCloseOnTriggerClick?: boolean;
    };

    let {
        text,
        shortcut,
        side = "top",
        open = $bindable(false),
        ref = $bindable(null),
        disableCloseOnTriggerClick,
        ...triggerProps
    }: Props = $props();
</script>