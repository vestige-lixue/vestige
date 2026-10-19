<button {...props} bind:this={ref} {type} class={["text-button activable focusable", { hoverable }, className]}>
    {@render children?.()}
</button>


<script lang="ts">
    import { type HTMLButtonAttributes } from "svelte/elements";

    type Props = HTMLButtonAttributes & {
        ref?: HTMLButtonElement | null;
        hoverable?: boolean;
    };
    let { ref = $bindable(null), type = "button", class: className, hoverable = true, children, ...props }: Props = $props();
</script>