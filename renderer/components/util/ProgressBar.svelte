<div class="progressBar" class:indeterminate={value === null} style:height>
    {#if value !== null}
        <div class="value" style:width={`${Math.min(1, Math.max(0, value)) * 100}%`}></div>
    {/if}
</div>


<style>
    .progressBar {
        position: relative;
        width: 100%;
        flex-shrink: 0;
        overflow: hidden;
        border-radius: 2px;
        outline: none;
        background: color-mix(in srgb, var(--c-accent) 20%, transparent);
    }
    .value {
        height: 100%;
        background: var(--c-accent);
    }
    .indeterminate::before, .indeterminate::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        background: var(--c-accent);
    }
    .indeterminate::before {
        left: -35%;
        right: 100%;
        animation: primaryProgress 2.1s cubic-bezier(.65, .815, .735, .395) infinite;
    }
    .indeterminate::after {
        left: -200%;
        right: 100%;
        animation: secondaryProgress 2.1s cubic-bezier(.165, .84, .44, 1) 1.15s infinite;
    }
    @keyframes primaryProgress {
        0% {
            left: -35%;
            right: 100%;
        }
        60%, 100% {
            left: 100%;
            right: -90%;
        }
    }
    @keyframes secondaryProgress {
        0% {
            left: -200%;
            right: 100%;
        }
        60%, 100% {
            left: 107%;
            right: -8%;
        }
    }
</style>


<script lang="ts">
    let { value = null, height = "4px" }: { value?: number | null; height?: string } = $props();
</script>