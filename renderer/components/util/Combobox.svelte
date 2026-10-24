<BitsCombobox.Root type="single" {items} {value} inputValue={value} {disabled} allowDeselect={false}
    onValueChange={setValue} bind:open onOpenChange={next => {
        if (!next) {
            query = "";
        }
        onOpenChange?.(next);
    }}>
    <div bind:this={container} class="combobox input-control">
        <BitsCombobox.Input {id} {placeholder} bind:ref={input} class="combobox-input" spellcheck={false} autocomplete="off"
            onfocus={async () => {
                if (open) return;
                // Let the trigger finish focusing and toggling before opening.
                await tick();
                if (open || disabled || input !== document.activeElement) return;
                query = input?.value ?? value;
                open = true;
                onOpenChange?.(true);
            }}
            oninput={event => {
                query = event.currentTarget.value;
                setValue(query);
            }} />
        <BitsCombobox.Trigger class="combobox-trigger icon-button hoverable activable focusable" onclick={() => query = ""}>
            <span class="chevron"></span>
        </BitsCombobox.Trigger>
        {@render actions?.()}
    </div>
    <BitsCombobox.Portal>
        <BitsCombobox.Content class="combobox-options option-surface" customAnchor={container} align="start" sideOffset={6} collisionPadding={8}
            style={`z-index: ${modal.getTopLayer()}; font-size: ${fontSize};`}>
            <BitsCombobox.Group>
                {#if header}<BitsCombobox.GroupHeading class="combobox-header">{header}</BitsCombobox.GroupHeading>{/if}
                {#each filteredItems as item (item.value)}
                    <BitsCombobox.Item class="option-item activable" value={item.value} label={item.label} disabled={item.disabled}>
                        {#snippet children({ selected })}
                            <span class="option-label">{item.label}</span>
                            <span class="option-checkmark">
                                {#if selected}
                                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                    {@html checkmark}
                                {/if}
                            </span>
                        {/snippet}
                    </BitsCombobox.Item>
                {/each}
            </BitsCombobox.Group>
        </BitsCombobox.Content>
    </BitsCombobox.Portal>
</BitsCombobox.Root>


<style>
    .combobox {
        display: flex;
        align-items: stretch;
    }
    .combobox:has(:global(.combobox-input:focus-visible)) {
        outline: 2px solid var(--c-accent);
        outline-offset: 2px;
    }
    :global(.combobox-input) {
        flex: 1;
        min-width: 0;
        width: 100%;
        padding: 8px 10px;
        border: none;
        border-radius: 6px;
        color: var(--c-text);
        background: transparent;
        font: inherit;
        user-select: text;
    }
    .combobox :global(.combobox-trigger) {
        flex-shrink: 0;
        width: calc(1lh + 16px);
        border-radius: 5px;
        padding: 0;
    }
    .chevron {
        width: 6px;
        height: 6px;
        margin-bottom: 3px;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: rotate(45deg);
    }
    :global(.combobox-options) {
        box-sizing: border-box;
        width: var(--bits-combobox-anchor-width);
        max-width: var(--bits-combobox-content-available-width);
        max-height: var(--bits-combobox-content-available-height);
        overflow-y: auto;
        font: inherit;
    }
    :global(.combobox-header) {
        padding: 6px 8px;
        color: var(--c-text-80p);
        font-size: .85em;
    }
</style>


<script lang="ts">
    import { tick, type Snippet } from "svelte";
    import { Combobox as BitsCombobox } from "bits-ui";
    import * as modal from "../../states/modal.svelte";
    import { observeFontSize } from "../../dom";
    import checkmark from "../../../resources/icons/carbon--checkmark.svg?raw";

    type Props = {
        items: { value: string; label: string; disabled?: boolean }[];
        value?: string;
        onValueChange?: (value: string) => void;
        onOpenChange?: (open: boolean) => void;
        disabled?: boolean;
        placeholder?: string;
        id?: string;
        header?: string;
        input?: HTMLInputElement | null;
        actions?: Snippet;
    };
    let {
        items, value = $bindable(""), onValueChange, onOpenChange, disabled = false,
        placeholder, id, header, input = $bindable(null), actions
    }: Props = $props();
    let open = $state(false);
    let query = $state("");
    let container = $state<HTMLDivElement | null>(null);
    let fontSize = $state("inherit");
    const filteredItems = $derived(query ? items.filter(item => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : items);

    function setValue(next: string): void {
        value = next;
        onValueChange?.(next);
    }

    $effect(() => {
        const element = container;
        if (!open || !element) return;
        return observeFontSize(element, size => fontSize = size);
    });
</script>