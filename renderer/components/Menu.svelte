<Menubar.Root class="menu">
    <Menubar.Menu>
        <Menubar.Trigger class="menu-trigger hoverable">文件</Menubar.Trigger>
        <Menubar.Portal>
            <Menubar.Content sideOffset={8}>
                <Menubar.Item class="hoverable" disabled={projectState.locked} onSelect={() => {
                    newProject();
                }}>新建</Menubar.Item>
                <Menubar.Item class="hoverable" disabled={projectState.locked} onSelect={() => {
                    openProject();
                }}>打开</Menubar.Item>
                <Menubar.Item class="hoverable" disabled={projectState.locked || !projectState.project} onSelect={() => {
                    saveProject();
                }}>保存</Menubar.Item>
                <Menubar.Item class="hoverable" disabled={projectState.locked || !projectState.project} onSelect={() => {
                    saveProject(true);
                }}>另存为</Menubar.Item>
                <Menubar.Item class="hoverable" disabled={projectState.locked || !projectState.project} onSelect={() => {
                    closeProject();
                }}>关闭</Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="hoverable" onSelect={() => {
                    window.api.openDevTools();
                }}>打开开发者工具</Menubar.Item>
                <Menubar.Item class="hoverable" onSelect={() => {}}>设置</Menubar.Item>
                <Menubar.Item class="hoverable" onSelect={() => {}}>关于</Menubar.Item>
            </Menubar.Content>
        </Menubar.Portal>
    </Menubar.Menu>
    <Menubar.Menu>
        <Menubar.Trigger class="menu-trigger hoverable">编辑</Menubar.Trigger>
        <Menubar.Portal>
            <Menubar.Content sideOffset={8}>
                <Menubar.Item class="hoverable" onSelect={() => {}}>撤销</Menubar.Item>
                <Menubar.Item class="hoverable" onSelect={() => {}}>重做</Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="hoverable" onSelect={() => {}}>剪切</Menubar.Item>
                <Menubar.Item class="hoverable" onSelect={() => {}}>复制</Menubar.Item>
                <Menubar.Item class="hoverable" onSelect={() => {}}>粘贴</Menubar.Item>
            </Menubar.Content>
        </Menubar.Portal>
    </Menubar.Menu>
    <Menubar.Menu>
        <Menubar.Trigger class="menu-trigger hoverable">播放</Menubar.Trigger>
        <Menubar.Portal>
            <Menubar.Content sideOffset={8} >
                <Menubar.Item class="hoverable" onSelect={() => {}}>播放</Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="hoverable" onSelect={() => {}}>上一词</Menubar.Item>
                <Menubar.Item class="hoverable" onSelect={() => {}}>下一词</Menubar.Item>
                <Menubar.Separator />
                <Menubar.Item class="hoverable" onSelect={() => {}}>下一文件</Menubar.Item>
                <Menubar.Item class="hoverable" onSelect={() => {}}>上一文件</Menubar.Item>
            </Menubar.Content>
        </Menubar.Portal>
    </Menubar.Menu>
</Menubar.Root>


<style>
    :global(.menu) {
        -webkit-app-region: drag;
        height: env(titlebar-area-height);
        margin-bottom: var(--drag-region-margin);
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        gap: 0;
        padding: 0 8px;
    }
    :global(.menu-trigger) {
        -webkit-app-region: no-drag;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 70%;
        padding: 0 16px;
        border-radius: 8px;
        font-size: 15px;
    }
    :global([data-menu-content]) {
        --bg: var(--c-surface);
        font-size: 15px;
        display: flex;
        flex-flow: column nowrap;
        background: var(--bg);
        padding: 4px;
        border-radius: 8px;
        min-width: 120px;
        box-shadow:
            0 0 0 1px var(--c-shadow-1),
            0 2px 6px -2px var(--c-shadow-2),
            0 12px 28px -4px var(--c-shadow-3);
    }
    :global([data-menubar-separator]) {
        height: 1px;
        margin: 4px 0;
        background: var(--c-border);
    }
    :global([data-menubar-item]) {
        font-size: 14px;
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 8px;
        cursor: pointer;
    }
    :global([data-menubar-item][data-disabled]) {
        cursor: default;
        opacity: 0.5;
        pointer-events: none;
    }
</style>


<script lang="ts">
    import { Menubar } from "bits-ui";
    import { closeProject, newProject, openProject, projectState, saveProject } from "../states/project.svelte";
</script>