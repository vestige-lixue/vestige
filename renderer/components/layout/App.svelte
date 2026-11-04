<svelte:head>
    <title>{project.projectState.project ? `${projectTitle(project.getFileName())} - ` : ""}Vestige</title>
</svelte:head>

<Tooltip.Provider delayDuration={300}>
    <FileDropOverlay />
    <ApplicationDialogs />
    <Sidebar />
    <div>
        {#if window.api.platform === "darwin"}
            <NativeMenu />
            <TitleBar />
        {:else}
            <Menu />
        {/if}
        <main bind:contentBoxSize={null, sizes => availableHeight = sizes?.[0]?.blockSize ?? 0}>
            <Player {availableHeight} />
            <Transcript />
        </main>
    </div>
</Tooltip.Provider>


<style>
    div, main {
        display: flex;
        flex-flow: column nowrap;
    }
    div {
        background: var(--c-background);
    }
    main {
        flex: 1;
        min-height: 0;
        overflow: clip;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import { projectTitle } from "../../projectTitle";
    import { onMount } from "svelte";
    import * as keybindings from "../../keybindings";
    import * as mediaSession from "../../states/mediaSession.svelte";
    import { Tooltip } from "bits-ui";
    import Menu from "./Menu.svelte";
    import NativeMenu from "./NativeMenu.svelte";
    import TitleBar from "./TitleBar.svelte";
    import Player from "../player/Player.svelte";
    import Sidebar from "../sidebar/Sidebar.svelte";
    import FileDropOverlay from "./FileDropOverlay.svelte";
    import ApplicationDialogs from "./ApplicationDialogs.svelte";
    import Transcript from "../transcript/Transcript.svelte";
    import * as project from "../../states/project.svelte";
    import * as settingsAPI from "../../states/settings";
    import * as transcriptionAPI from "../../states/transcription";
    import * as projectAPI from "../../states/project";
    import { prepareSettingsForQuit } from "../../states/settingsPersistence";

    let availableHeight = $state(0);

    $effect(() => {
        document.documentElement.lang = i18n.getLocale();
        document.documentElement.dir = "ltr";
    });

    onMount(() => {
        const stopKeybindings = keybindings.mount();
        const stopMediaSession = mediaSession.mount();
        void settingsAPI.initialize();
        const stopTranscription = transcriptionAPI.startLifecycle();
        const stopProject = projectAPI.startLifecycle(prepareSettingsForQuit);
        return () => {
            stopKeybindings();
            stopMediaSession();
            stopTranscription();
            stopProject();
            settingsAPI.dispose();
        };
    });
</script>