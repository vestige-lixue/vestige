<aside
    style:width={typeof width === "number" ? `${width}px` : width}
    style:min-width={`${minWidth}px`}
    style:max-width={maxWidth}
>
    <div class="logo">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html logo}
    </div>
    <MediaList />
    <SideNav />
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
    import { minSidebarWidth, maxSidebarWidth } from "../../../shared/constants";
    import * as settingsAPI from "../../states/settings";

    const minWidth = minSidebarWidth;
    const maxWidth = `min(40vw, ${maxSidebarWidth}px)`;
    const width = $derived(settings.getSidebarWidth() ?? "min(22vw, 200px)");
</script>