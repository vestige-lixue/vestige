<Select.Root type="single" {items} {disabled} bind:value {onValueChange} bind:open={() => open, value => {
    // Let the dialog remember the trigger before the listbox opens its own focus scope.
    if (value) trigger?.focus({ preventScroll: true });
    open = value;
}}>
    <Select.Trigger {id} bind:ref={trigger} class={["dropdownSelector input-control hoverable activable focusable", className]} onblur={event => {
        // Release the listbox's focus scope before the dialog receives focus on the next control.
        if (open && event.relatedTarget instanceof Node && !content?.contains(event.relatedTarget)) flushSync(() => open = false);
    }}>
        <span class="value">
            <Select.Value {placeholder} />
            {#each items as item (item.value)}
                <span class="measure">{item.label}</span>
            {/each}
            <span class="measure">{placeholder}</span>
        </span>
        <span class="dropdown-chevron" aria-hidden="true"></span>
    </Select.Trigger>
    <Select.Portal>
        <Select.Content bind:ref={content} class="dropdownOptions option-surface" style={`z-index: ${modal.getTopLayer()}; font-size: ${fontSize};`} {align} sideOffset={6} collisionPadding={8}>
            {#each items as item (item.value)}
                <Select.Item class="option-item activable" value={item.value} label={item.label} disabled={item.disabled}>
                    {#snippet children({ selected })}
                        <div class="option-label">{item.label}</div>
                        <div class="option-checkmark">
                            {#if selected}
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html checkmark}
                            {/if}
                        </div>
                    {/snippet}
                </Select.Item>
            {/each}
        </Select.Content>
    </Select.Portal>
</Select.Root>


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


<script lang="ts">
    import { flushSync } from "svelte";
    import { Select } from "bits-ui";
    import * as modal from "../../states/modal.svelte";
    import { observeFontSize } from "../../dom";
    import checkmark from "../../../resources/icons/carbon--checkmark.svg?raw";

    type Props = {
        items: { value: string; label: string; disabled?: boolean }[];
        value?: string;
        onValueChange?: (value: string) => void;
        disabled?: boolean;
        placeholder?: string;
        id?: string;
        class?: string;
        align?: Select.ContentProps["align"];
    };

    let {
        items,
        value = $bindable(""),
        onValueChange,
        disabled = false,
        placeholder,
        id,
        class: className = "",
        align = "center"
    }: Props = $props();

    let open = $state(false);
    let trigger = $state<HTMLButtonElement | null>(null);
    let content = $state<HTMLDivElement | null>(null);
    let fontSize = $state("inherit");

    $effect(() => {
        const element = trigger;
        if (!open || !element) return;
        return observeFontSize(element, size => fontSize = size);
    });
</script>