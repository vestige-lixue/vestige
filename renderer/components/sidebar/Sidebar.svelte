<aside
    style:width={typeof width === "number" ? `${width}px` : width}
    style:min-width={`${minWidth}px`}
    style:max-width={maxWidth}
>
    <div class="logo">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html logo}
    </div>
    {#if mediaImport.getIds().length > 0}
        <div class="skip-media">
            <button type="button" class="text-button focusable" onclick={() => navigationButton?.focus({ preventScroll: true })}>
                {i18n.t("media.actions.skip")}
            </button>
        </div>
    {/if}
    <MediaList />
    <SideNav bind:firstButton={navigationButton} />
</aside>
<Resizer
    direction="vertical"
    origin={width}
    min={minWidth}
    max={maxWidth}
    changeCB={value => void settingsAPI.update({ layout: { sidebarWidth: value } })}
    thickness={3}
/>


<style>
    aside {
        --bg: var(--c-surface);
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
        min-height: 0;
        background: var(--bg);
    }
    :global(:root.mica) aside {
        --bg: var(--c-background);
        background: color-mix(in srgb, var(--c-background), transparent var(--sidebar-transparency));
    }
    .skip-media {
        position: relative;
        align-self: stretch;
        z-index: 1;
    }
    .skip-media button {
        position: absolute;
        top: 4px;
        left: 8px;
        right: 8px;
        background: var(--c-background);
    }
    .skip-media button:not(:focus) {
        clip-path: inset(50%);
        pointer-events: none;
    }
    .logo {
        -webkit-app-region: drag;
        display: flex;
        align-items: center;
        justify-content: center;
        align-self: stretch;
        flex-shrink: 0;
        height: env(titlebar-area-height);
        padding: 0 12px 0 calc(env(titlebar-area-x) + 16px);
        margin-bottom: var(--drag-region-margin);
    }
    .logo :global(svg) {
        display: block;
        width: auto;
        height: 100%;
        max-width: 100%;
        pointer-events: none;
        transform: translateY(6px);
    }
</style>


<script lang="ts">
    import logo from "../../../resources/logos/logo-black.svg?raw";
    import MediaList from "./MediaList.svelte";
    import SideNav from "./SideNav.svelte";
    import Resizer from "../util/Resizer.svelte";
    import * as settings from "../../states/settings.svelte";
    import * as mediaImport from "../../states/mediaImport.svelte";
    import * as i18n from "../../i18n.svelte";
    import { minSidebarWidth, maxSidebarWidth } from "../../../shared/constants";
    import * as settingsAPI from "../../states/settings";

    let navigationButton = $state<HTMLButtonElement | null>(null);

    const minWidth = minSidebarWidth;
    const maxWidth = `min(40vw, ${maxSidebarWidth}px)`;
    const width = $derived(settings.getSidebarWidth() ?? "min(22vw, 200px)");
</script>