<Tooltip text={confirming ? i18n.t("common.confirmAgain") : text} bind:open={tooltipOpen} disableCloseOnTriggerClick
    {disabled} {tabindex} {onfocus} onclick={activate}>
    {#snippet child({ props })}
        <button {...props} class="deleteButton icon-button hoverable activable focusable danger" bind:this={button} style={`--delete-size: ${size};`}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html confirming ? checkIcon : removeIcon}
        </button>
    {/snippet}
</Tooltip>


<style>
    .deleteButton {
        box-sizing: border-box;
        width: var(--delete-size);
        height: var(--delete-size);
        flex-shrink: 0;
    }
    .deleteButton:disabled {
        opacity: 0.4;
    }
</style>


<script lang="ts">
    import { untrack } from "svelte";
    import * as i18n from "../../i18n.svelte";
    import Tooltip from "./Tooltip.svelte";
    import removeIcon from "../../../resources/icons/carbon--trash-can.svg?raw";
    import checkIcon from "../../../resources/icons/carbon--checkmark.svg?raw";

    type Props = {
        text: string;
        onconfirm: () => void;
        disabled?: boolean;
        tabindex?: number;
        onfocus?: (event: FocusEvent) => void;
        resetKey?: unknown;
        size?: string;
    };
    let { text, onconfirm, disabled = false, tabindex = 0, onfocus, resetKey, size = "26px" }: Props = $props();
    let confirming = $state(false);
    let tooltipOpen = $state(false);
    let button = $state<HTMLButtonElement>();

    $effect(() => {
        void [resetKey, disabled];
        untrack(reset);
    });
    $effect(() => {
        if (!confirming) return;
        const outside = (event: Event): void => {
            if (!button || !event.composedPath().includes(button)) reset();
        };
        window.addEventListener("pointerdown", outside, true);
        window.addEventListener("click", outside, true);
        return () => {
            window.removeEventListener("pointerdown", outside, true);
            window.removeEventListener("click", outside, true);
        };
    });

    function reset(): void {
        confirming = false;
        tooltipOpen = false;
    }

    function activate(event: MouseEvent): void {
        event.stopPropagation();
        if (disabled) return;
        if (confirming) {
            reset();
            onconfirm();
        }
        else {
            confirming = true;
            tooltipOpen = true;
        }
    }
</script>