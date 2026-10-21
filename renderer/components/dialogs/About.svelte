<Modal bind:open
    escBehavior="close"
    clickMaskBehavior="close"
    width="511.2px"
    onOpenChangeComplete={open => {
        if (!open) onClosed();
    }}
>
    <div class="about">
        <div class="logo">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html logo}
        </div>
        <div class="content" class:show-license={showLicense}>
            <div class="introduction">
                <div class="name">{i18n.t("about.name")}</div>
                <div class="desc">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html i18n.html("about.description")}
                </div>
                <div class="quote">
                    <div>“</div>
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html i18n.html("about.quote")}
                    <div>”</div>
                </div>
            </div>
            {#if showLicense}
                <pre class="license">{license}</pre>
            {/if}
        </div>
        <div class="meta">
            <div>v{version}</div>
            <div><a href="https://github.com/vestige-lixue/vestige" target="_blank">https://github.com/vestige-lixue/vestige</a></div>
            <div>Copyright © {new Date().getFullYear()} <a class="focusable" href="https://github.com/ljm12914" target="_blank">LJM12914</a></div>
            <div><LocalizedText text={i18n.t("about.license")} slots={{ license: licenseLink }} />
                {#snippet licenseLink()}<button class="link-button focusable" onclick={() => showLicense = !showLicense}>AGPL-3.0-or-later</button>{/snippet}
            </div>
        </div>
    </div>
</Modal>


<style>
    .about {
        width: 100%;
        height: 100%;
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
        text-align: center;
    }
    .about :global(*) {
        user-select: text;
    }
    .logo {
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        height: 100px;
        margin-bottom: 10px;
    }
    .logo :global(svg) {
        display: block;
        width: auto;
        height: 85%;
        max-width: 100%;
        pointer-events: none;
    }
    .content {
        position: relative;
        width: 100%;
    }
    .introduction {
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
    }
    .show-license .introduction {
        visibility: hidden;
    }
    .license {
        --bg: var(--c-surface);
        position: absolute;
        inset: 0 0 25px;
        margin: 0;
        padding: 16px;
        border: 1px solid var(--c-border);
        border-radius: 8px;
        background: var(--bg);
        overflow: auto;
        text-align: left;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font: inherit;
        font-size: 13px;
        line-height: 1.6;
    }
    .name {
        font-size: 24px;
        margin-bottom: 25px;
        font-weight: bold;
    }
    .desc {
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
        font-size: 17px;
        margin-bottom: 25px;
        gap: 4px;
    }
    .quote {
        color: var(--c-text-80p);
        margin-bottom: 25px;
        border-left: solid 3px var(--c-border-120p);
        padding-left: 16px;
        width: 100%;
        text-align: left;
    }
    .quote > :first-child, .quote > :last-child {
        font-family: "Noto Sans SC", "Noto Sans CJK SC", "Songti SC", "PingFang SC", SimSun, serif;
        font-size: 28px;
    }
    .quote > :first-child {
        margin-left: -.5em;
        margin-bottom: -32px;
    }
    .quote > :last-child {
        margin-bottom: -.5em;
    }
    .quote > :global(:nth-child(2)) {
        text-indent: 26px;
    }
    .meta {
        display: flex;
        flex-flow: column nowrap;
        align-items: center;
        gap: 4px;
    }
</style>


<script lang="ts">
    import * as i18n from "../../i18n.svelte";
    import LocalizedText from "../util/LocalizedText.svelte";
    import Modal from "../util/Modal.svelte";
    import logo from "../../../resources/logos/logo-black.svg?raw";
    import license from "../../../LICENSE?raw";
    import { version } from "../../meta";

    let { open = $bindable(), onClosed }: { open: boolean; onClosed: () => void } = $props();
    let showLicense = $state(false);
</script>