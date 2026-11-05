<BitsCombobox.Root type="single" {items} {value} inputValue={value} {disabled} allowDeselect={false}
    onValueChange={setValue} bind:open={() => open, setOpen}>
    <div bind:this={container} class="combobox input-control">
        <BitsCombobox.Input {id} {placeholder} bind:ref={input} class="combobox-input" spellcheck={false} autocomplete="off"
            onfocus={async () => {
                if (open || (clearable && modal.isRestoringFocus(input))) return;
                // Let the trigger finish focusing and toggling before opening.
                await tick();
                if (open || disabled || input !== document.activeElement) return;
                query = input?.value ?? value;
                setOpen(true);
            }}
            oninput={event => {
                query = event.currentTarget.value;
                setValue(query);
            }} />
        {#if clearable && value}
            <button bind:this={clearButton} type="button" class="clear icon-button hoverable activable focusable" {disabled} aria-label={i18n.t("common.clear")}
                onpointerdown={event => event.preventDefault()} onclick={() => {
                    query = "";
                    setValue("");
                    setOpen(true);
                    modal.restoreFocus(input, { preventScroll: true });
                }}>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html closeIcon}
            </button>
        {/if}
        <BitsCombobox.Trigger class="combobox-trigger icon-button hoverable activable focusable" onclick={() => query = ""}>
            <span class="dropdown-chevron" aria-hidden="true"></span>
        </BitsCombobox.Trigger>
        {@render actions?.()}
    </div>
    <BitsCombobox.Portal>
        <BitsCombobox.Content class="combobox-options option-surface" customAnchor={container} align="start" sideOffset={6} collisionPadding={8}
            style={`z-index: ${modal.getTopLayer()}; font-size: ${fontSize};`} onInteractOutside={event => {
                if (event.target === clearButton) event.preventDefault();
            }} onFocusOutside={event => {
                if (event.target instanceof Node && !container?.contains(event.target)) setOpen(false);
            }}>
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
    .clear, .combobox :global(.combobox-trigger) {
        flex-shrink: 0;
        width: calc(1lh + 16px);
        border-radius: 5px;
        padding: 0;
    }
    .clear :global(svg) {
        width: 16px;
        height: 16px;
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
    import * as i18n from "../../i18n.svelte";
    import * as modal from "../../states/modal.svelte";
    import { observeFontSize } from "../../dom";
    import checkmark from "../../../resources/icons/carbon--checkmark.svg?raw";
    import closeIcon from "../../../resources/icons/carbon--close.svg?raw";

    type Props = {
        items: { value: string; label: string; disabled?: boolean }[];
        value?: string;
        onValueChange?: (value: string) => void;
        onOpenChange?: (open: boolean) => void;
        disabled?: boolean;
        clearable?: boolean;
        placeholder?: string;
        id?: string;
        header?: string;
        input?: HTMLInputElement | null;
        actions?: Snippet;
    };
    let {
        items, value = $bindable(""), onValueChange, onOpenChange, disabled = false, clearable = false,
        placeholder, id, header, input = $bindable(null), actions
    }: Props = $props();
    let open = $state(false);
    let query = $state("");
    let container = $state<HTMLDivElement | null>(null);
    let clearButton = $state<HTMLButtonElement>();
    let fontSize = $state("inherit");
    const filteredItems = $derived(query ? items.filter(item => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : items);

    function setOpen(next: boolean): void {
        if (open === next) return;
        open = next;
        if (!next) query = "";
        onOpenChange?.(next);
    }

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