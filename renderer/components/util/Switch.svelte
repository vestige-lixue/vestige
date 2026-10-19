<BitsSwitch.Root {...restProps} bind:checked bind:ref>
    {#snippet child({ props })}
        <button {...props} class={["switch focusable", className]}>
            <BitsSwitch.Thumb>
                {#snippet child({ props })}
                    <span {...props} class="thumb"></span>
                {/snippet}
            </BitsSwitch.Thumb>
        </button>
    {/snippet}
</BitsSwitch.Root>


<style>
    .switch {
        position: relative;
        box-sizing: border-box;
        flex-shrink: 0;
        width: 46px;
        height: 24px;
        padding: 0;
        border: none;
        border-radius: 12px;
        background: var(--c-border);
        transition: background-color .15s ease;
    }
    .switch[data-state="checked"] {
        background: var(--c-accent);
    }
    .switch:disabled {
        opacity: 0.5;
    }
    .thumb {
        position: absolute;
        top: 4px;
        left: 4px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--c-background);
        transition: left .15s ease, transform .15s ease;
    }
    .thumb[data-state="checked"] {
        left: calc(100% - 4px);
        transform: translateX(-100%);
    }
</style>


<script lang="ts">
    import { Switch as BitsSwitch } from "bits-ui";

    type Props = Omit<BitsSwitch.RootProps, "child" | "children">;
    let { checked = $bindable(false), ref = $bindable(null), class: className, ...restProps }: Props = $props();
</script>