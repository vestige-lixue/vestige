<Popover.Content {...props} bind:ref class={["popoverContent", className]}>
    {@render children?.()}
</Popover.Content>


<style>
    :global(.popoverContent) {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        max-width: max(0px, var(--bits-popover-content-available-width));
        max-height: max(0px, var(--bits-popover-content-available-height));
        overflow: auto;
        scrollbar-gutter: auto;
    }
</style>


<script lang="ts">
    import { Popover } from "bits-ui";

    let { ref = $bindable(null), class: className, children, ...props }: Omit<Popover.ContentProps, "child"> = $props();
</script>