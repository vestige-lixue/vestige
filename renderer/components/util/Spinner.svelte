<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.2" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
</svg>


<style>
    svg {
        display: block;
        flex-shrink: 0;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
        svg { animation: none; }
    }
</style>


<script lang="ts">
    const { size = "1em" }: { size?: string } = $props();
</script>