<Tooltip.Root bind:open {disableCloseOnTriggerClick}>
    <Tooltip.Trigger {...triggerProps} />
    <Tooltip.Portal>
        <Tooltip.Content class="tooltip-content" style={`z-index: ${modalLayers.top};`} {side} sideOffset={6} collisionPadding={8}>
            {text}
        </Tooltip.Content>
    </Tooltip.Portal>
</Tooltip.Root>


<style>
    :global(.tooltip-content) {
        max-width: min(320px, calc(100vw - 16px));
        padding: 6px 8px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        color: var(--c-text);
        background: var(--c-surface);
        box-shadow: 0 4px 12px var(--c-shadow-3);
        font-size: 12px;
        line-height: 1.5;
        overflow-wrap: anywhere;
        transform-origin: var(--bits-tooltip-content-transform-origin);
        opacity: 1;
        transform: translate(0, 0) scale(1);
        transition: opacity .16s ease-out, transform .16s ease-out;
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
    import { Tooltip } from "bits-ui";
    import { modalLayers } from "../../states/modal.svelte";

    let {
        text,
        side = "top",
        open = $bindable(false),
        disableCloseOnTriggerClick,
        ...triggerProps
    }: Tooltip.TriggerProps & {
        text: string;
        side?: Tooltip.ContentProps["side"];
        open?: boolean;
        disableCloseOnTriggerClick?: boolean;
    } = $props();
</script>