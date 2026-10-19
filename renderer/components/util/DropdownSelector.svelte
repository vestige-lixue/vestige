<Select.Root type="single" {items} {disabled} bind:value {onValueChange} bind:open>
    <Select.Trigger {id} bind:ref={trigger} class={["dropdownSelector input-control hoverable activable focusable", className]}>
        <span class="value">
            <Select.Value {placeholder} />
            {#each items as item (item.value)}
                <span class="measure">{item.label}</span>
            {/each}
            <span class="measure">{placeholder}</span>
        </span>
    </Select.Trigger>
    <Select.Portal>
        <Select.Content class="dropdownOptions option-surface" style={`z-index: ${modal.getTopLayer()}; font-size: ${fontSize};`} {align} sideOffset={6} collisionPadding={8}>
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
    :global(.dropdownSelector)::after {
        content: "";
        flex-shrink: 0;
        width: 6px;
        height: 6px;
        margin-bottom: 3px;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: rotate(45deg);
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
        visibility: hidden;
    }
    :global(.dropdownOptions) {
        min-width: var(--bits-select-anchor-width);
        max-width: var(--bits-select-content-available-width);
        max-height: var(--bits-select-content-available-height);
        overflow-y: auto;
        font: inherit;
    }
</style>


<script lang="ts">
    import { Select } from "bits-ui";
    import * as modal from "../../states/modal.svelte";
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
    let fontSize = $state("inherit");

    $effect(() => {
        const element = trigger;
        if (!open || !element) return;
        const syncFontSize = (): void => {
            fontSize = getComputedStyle(element).fontSize;
        };
        syncFontSize();
        const observer = new ResizeObserver(syncFontSize);
        observer.observe(element);
        return () => observer.disconnect();
    });
</script>