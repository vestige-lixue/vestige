<aside>
    <div class="logo">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html logo}
    </div>
    <RecordList />
    <nav>
        <button class="hoverable">词库</button>
        <button class="hoverable">转写任务</button>
        <button class="hoverable">设置</button>
    </nav>
</aside>


<style>
    aside {
        --bg: var(--c-surface);
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
        min-height: 0;
        background: var(--bg);
        border-right: 1px solid var(--c-border);
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
        height: 85%;
        max-width: 100%;
        pointer-events: none;
    }
    nav {
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
        width: 100%;
        margin-top: auto;
    }
    nav button {
        display: grid;
        place-items: center;
        width: 100%;
        padding: 8px 0;
        font-size: 16px;
    }
</style>


<script lang="ts">
    import logo from "../assets/logo.svg?raw";
    import RecordList from "./RecordList.svelte";
</script>