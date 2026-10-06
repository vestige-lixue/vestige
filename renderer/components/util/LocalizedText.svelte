{#each parts as part, index (index)}
    {@const snippet = part.startsWith("<") ? slots[part.slice(1, -2)] : undefined}
    {#if snippet}{@render snippet()}{:else}{part}{/if}
{/each}

<script lang="ts">
    import { type Snippet } from "svelte";

    // Only named snippets can produce markup. All other text is escaped by Svelte.
    let { text, slots }: { text: string; slots: Record<string, Snippet> } = $props();
    const parts = $derived(text.split(/(<[a-z]+\/>)/));
</script>