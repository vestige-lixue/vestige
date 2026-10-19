<DocumentDialog bind:open kind="params" toc {onClosed} />


<script lang="ts">
    import DocumentDialog from "./DocumentDialog.svelte";

    let { open = $bindable(), onClosed }: { open: boolean; onClosed: () => void } = $props();
</script>