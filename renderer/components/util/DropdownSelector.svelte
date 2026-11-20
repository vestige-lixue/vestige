<Select.Root type="single" {items} {disabled} bind:value {onValueChange} bind:open={() => open, value => {
    // Let the dialog remember the trigger before the listbox opens its own focus scope.
    if (value) {
        triggerDetailsOpen = false;
        trigger?.focus({ preventScroll: true });
    }
    open = value;
}}>
    <Select.Trigger {id} bind:ref={trigger} class={["dropdownSelector input-control hoverable activable focusable", className]} onblur={event => {
        // Release the listbox's focus scope before the dialog receives focus on the next control.
        if (open && event.relatedTarget instanceof Node && !content?.contains(event.relatedTarget)) flushSync(() => open = false);
    }}>
        {#snippet child({ props })}
            {#if itemDetails && selected}
                <Tooltip id={props.id as string} disableCloseOnTriggerClick={false} bind:open={() => triggerDetailsOpen, value => triggerDetailsOpen = value && !open}>
                    {#snippet text()}{@render itemDetails(selected)}{/snippet}
                    {#snippet child({ props: tooltip })}
                        <button {...mergeProps(tooltip, props)}>{@render caption()}</button>
                    {/snippet}
                </Tooltip>
            {:else}
                <button {...props}>{@render caption()}</button>
            {/if}
        {/snippet}
    </Select.Trigger>
    <Select.Portal>
        <Select.Content bind:ref={content} class="dropdownOptions option-surface" style={`z-index: ${modal.getTopLayer()}; font-size: ${fontSize};`} {align} sideOffset={6} collisionPadding={8}>
            {#each items as item (item.value)}
                <Select.Item class="option-item activable" value={item.value} label={item.label} disabled={item.disabled}>
                    {#snippet child({ props, selected })}
                        {#if itemDetails}
                            <Tooltip id={props.id as string} side="right" sideOffset={24} tabindex={-1}>
                                {#snippet text()}{@render itemDetails(item)}{/snippet}
                                {#snippet child({ props: tooltip })}
                                    <div {...mergeProps(tooltip, props)}>{@render option(item, selected)}</div>
                                {/snippet}
                            </Tooltip>
                        {:else}
                            <div {...props}>{@render option(item, selected)}</div>
                        {/if}
                    {/snippet}
                </Select.Item>
            {/each}
        </Select.Content>
    </Select.Portal>
</Select.Root>

{#snippet caption()}
    <span class="value">
        {#if selected}<span class="run-label">{selected.label}</span>{:else}<Select.Value {placeholder} />{/if}
        {#each items as item (item.value)}<span class="measure">{item.label}</span>{/each}
        <span class="measure">{placeholder}</span>
    </span>
    <span class="dropdown-chevron" aria-hidden="true"></span>
{/snippet}

{#snippet option(item: Item, checked: boolean)}
    <div class="option-label">{item.label}</div>
    <div class="option-checkmark">
        {#if checked}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html checkmark}
        {/if}
    </div>
{/snippet}


<style>
    :global(.dropdownSelector) {
        width: 100%;
        padding: 7px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        text-align: left;
    }
    :global(.dropdownSelector:disabled), :global(.dropdownSelector[data-disabled]) {
        opacity: 0.5;
        cursor: default;
    }
    .value {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        flex: 1;
        min-width: 0;
    }
    .value > :global(*) {
        grid-area: 1 / 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .measure {
        /* Reserve the extra space used by the menu padding and checkmark. */
        padding-right: 10px;
        visibility: hidden;
    }
    :global(.dropdownOptions) {
        width: var(--bits-select-anchor-width);
        max-width: var(--bits-select-content-available-width);
        max-height: var(--bits-select-content-available-height);
        overflow-y: auto;
        font: inherit;
    }
</style>


<script lang="ts" generics="Item extends { value: string; label: string; disabled?: boolean }">
    import { flushSync, type Snippet } from "svelte";
    import { mergeProps, Select } from "bits-ui";
    import Tooltip from "./Tooltip.svelte";
    import * as modal from "../../states/modal.svelte";
    import { observeFontSize } from "../../dom";
    import checkmark from "../../../resources/icons/lucide--check.svg?raw";

    type Props = {
        items: Item[];
        itemDetails?: Snippet<[Item]>;
        value?: string;
        onValueChange?: (value: string) => void;
        disabled?: boolean;
        placeholder?: string;
        id?: string;
        class?: string;
        align?: Select.ContentProps["align"];
    };

    let {
        items, itemDetails,
        value = $bindable(""),
        onValueChange,
        disabled = false,
        placeholder,
        id,
        class: className = "",
        align = "center"
    }: Props = $props();

    let open = $state(false);
    let triggerDetailsOpen = $state(false);
    const selected = $derived(itemDetails && items.find(item => item.value === value));
    let trigger = $state<HTMLButtonElement | null>(null);
    let content = $state<HTMLDivElement | null>(null);
    let fontSize = $state("inherit");

    $effect(() => {
        const element = trigger;
        if (!open || !element) return;
        return observeFontSize(element, size => fontSize = size);
    });
</script>