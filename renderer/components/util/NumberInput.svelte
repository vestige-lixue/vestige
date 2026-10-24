<div class={["number-input input-control", className]} {style}>
    <input {...props} type="number" bind:this={ref} bind:value />
    {#if unit}<span class="unit">{unit}</span>{/if}
</div>


<style>
    .number-input {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .number-input:has(input:focus-visible) {
        outline: 2px solid var(--c-accent);
        outline-offset: 2px;
    }
    input {
        flex: 1;
        width: 82px;
        min-width: 0;
        padding: 6px 8px;
        border: 0;
        border-radius: inherit;
        color: inherit;
        background: transparent;
        font: inherit;
        font-variant-numeric: tabular-nums;
    }
    .unit {
        flex: none;
        padding-right: 8px;
        color: var(--c-text-80p);
        font-size: 14px;
        line-height: 1.6;
    }
</style>


<script lang="ts">
    import { type HTMLInputAttributes } from "svelte/elements";

    type Props = Omit<HTMLInputAttributes, "type" | "value"> & {
        value?: number;
        ref?: HTMLInputElement;
        unit?: string;
    };
    let { value = $bindable(), ref = $bindable(), unit, class: className, style, ...props }: Props = $props();
</script>