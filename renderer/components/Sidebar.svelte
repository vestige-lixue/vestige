<aside>
    <div class="logo">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html logo}
    </div>
    <RecordList />
    <nav>
        <button>词库</button>
        <button>转写任务</button>
        <button>设置</button>
    </nav>
</aside>


<style>
    aside {
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
        min-height: 0;
        background: var(--c-surface);
        border-right: 1px solid var(--color-border);
    }
    .logo {
        -webkit-app-region: drag;
        display: flex;
        align-items: center;
        justify-content: center;
        align-self: stretch;
        flex-shrink: 0;
        height: var(--titlebar-height);
        padding: 0 16px 0 calc(env(titlebar-area-x) + 16px);
        margin-bottom: var(--drag-region-margin);
    }
    .logo :global(svg) {
        display: block;
        width: auto;
        height: 80%;
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
    }
    nav button:hover {
        background: aqua;
    }
</style>


<script lang="ts">
    import logo from "../assets/logo.svg?raw";
    import RecordList from "./RecordList.svelte";
</script>