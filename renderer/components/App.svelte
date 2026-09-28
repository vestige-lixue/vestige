<div class="workspace">
    <Sidebar />
    <main>
        <Menu />
        <Player />
        <section class="transcript">
            <article class="transcript-document">
                <p class="placeholder">转写正文将在这里显示。</p>
            </article>
        </section>
    </main>
</div>


<style>
    .workspace {
        display: grid;
        grid-template-columns: clamp(176px, 22vw, 240px) minmax(0, 1fr);
        height: 100%;
        overflow: hidden;
    }
    main {
        display: flex;
        flex-flow: column nowrap;
    }
    .transcript {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        min-height: 0;
    }
    .transcript-document {
        padding: 24px 28px;
        overflow-y: auto;
        overflow-wrap: anywhere;
        font-size: 16px;
        line-height: 1.8;
    }
    .transcript-document p {
        margin: 0 0 1em;
    }
    .placeholder {
        color: var(--color-muted);
    }
</style>


<script lang="ts">
    import Menu from "./Menu.svelte";
    import Player from "./Player.svelte";
    import Sidebar from "./Sidebar.svelte";
</script>