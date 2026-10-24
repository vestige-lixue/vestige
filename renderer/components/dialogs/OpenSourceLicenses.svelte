<Modal bind:open width="800px" height="75%" escBehavior="close" clickMaskBehavior="close" onOpenChangeComplete={open => {
    if (!open) onClosed();
}}>
    <Dialog.Title class="modal-title">{i18n.t("licenses.title")}</Dialog.Title>
    <table class="licenses">
        <colgroup>
            <col style="width: var(--project-column-width);" />
            <col style="width: var(--license-column-width);" />
            <col style="width: var(--url-column-width);" />
        </colgroup>
        <thead>
            <tr>
                <th scope="col">{i18n.t("licenses.columns.project")}</th>
                <th scope="col">{i18n.t("licenses.columns.license")}</th>
                <th scope="col">{i18n.t("licenses.columns.url")}</th>
            </tr>
        </thead>
        {#each projects as project (project.name)}
            <tbody>
                <tr class="project-row hoverable activable" class:expanded={expanded.includes(project.name)} onclick={event => handleRowClick(event, project.name)}>
                    <td>
                        <button class="project-toggle focusable" onclick={() => toggleProject(project.name)}>
                            <span class="chevron">
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html chevronRight}
                            </span>
                            <span>{project.name}</span>
                        </button>
                    </td>
                    <td>{project.license}</td>
                    <td><a class="focusable" href={project.url} target="_blank">{project.url}</a></td>
                </tr>
                {#if expanded.includes(project.name)}
                    <tr>
                        <td colspan="3" class="license-details">
                            <div class="license-content">
                                {#if project.text !== null}
                                    <pre>{project.text}</pre>
                                {:else}
                                    <div class="license-note">{i18n.t("licenses.ffmpegNote")}</div>
                                    <TextButton class="openDirectory" disabled={openingDirectory} onclick={() => void openFFmpegDirectory()}>
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        {@html externalLink}
                                        {i18n.t("licenses.actions.openFFmpegDirectory")}
                                    </TextButton>
                                    {#if directoryFailure}<div class="error-message">{directoryFailure}</div>{/if}
                                {/if}
                            </div>
                        </td>
                    </tr>
                {/if}
            </tbody>
        {/each}
    </table>
</Modal>


<style>
    .licenses {
        --project-column-width: 30%;
        --license-column-width: 20%;
        --url-column-width: 50%;
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        text-align: left;
        line-height: 1.6;
    }
    .licenses tbody * {
        user-select: text;
    }
    .licenses tbody {
        border-bottom: 1px solid var(--c-border);
    }
    .licenses tbody:last-child {
        border-bottom: none;
    }
    .licenses th, .licenses td {
        padding: 10px 12px;
        vertical-align: top;
    }
    .licenses th {
        border-bottom: 1px solid var(--c-border);
        color: var(--c-text-80p);
        font-weight: 600;
        white-space: nowrap;
    }
    .licenses th:first-child, .licenses td:first-child {
        padding-left: 0;
    }
    .licenses th:last-child, .licenses td:last-child {
        padding-right: 0;
    }
    .licenses a {
        overflow-wrap: anywhere;
    }
    .project-row {
        cursor: pointer;
    }
    .project-toggle {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        color: inherit;
        text-align: left;
        line-height: inherit;
        overflow-wrap: anywhere;
    }
    .chevron {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        width: 16px;
        height: 1.6em;
    }
    .chevron :global(svg) {
        width: 16px;
        height: 16px;
    }
    .project-row.expanded .chevron {
        transform: rotate(90deg);
    }
    .licenses .license-details {
        padding: 0 0 16px;
    }
    .license-content {
        --bg: var(--c-surface);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--c-border);
        border-radius: 8px;
        background: var(--bg);
    }
    .license-note {
        color: var(--c-text-80p);
        line-height: 1.6;
    }
    pre {
        width: 100%;
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        user-select: text;
        font: inherit;
        font-size: 13px;
        line-height: 1.6;
    }
</style>


<script lang="ts">
    import TextButton from "../util/TextButton.svelte";
    import * as i18n from "../../i18n.svelte";
    import { describeFailure } from "../../failures";
    import { toFailureInfo } from "../../../shared/failure";
    import { Dialog } from "bits-ui";
    import Modal from "../util/Modal.svelte";
    import externalLink from "../../../resources/icons/cil--external-link.svg?raw";
    import chevronRight from "../../../resources/icons/carbon--chevron-right.svg?raw";
    import licenseManifest from "../../../resources/licenses/sources.json";

    let { open = $bindable(), onClosed }: { open: boolean; onClosed: () => void } = $props();
    let expanded = $state<string[]>([]);
    let openingDirectory = $state(false);
    let directoryFailure = $state("");

    const licenseTexts = import.meta.glob<string>("../../../resources/licenses/*.txt", { query: "?raw", import: "default", eager: true });
    const projects = licenseManifest.map(project => ({
        name: project.name,
        license: project.license,
        url: project.url,
        text: project.files.length === 0 ? null : project.files.map(({ file }) => {
            const text = licenseTexts[`../../../resources/licenses/${file}`];
            if (text === undefined) throw new Error(`Missing bundled license text: ${file}`);
            return text;
        }).join("\n\n")
    }));

    function toggleProject(name: string): void {
        expanded = expanded.includes(name) ? expanded.filter(project => project !== name) : [...expanded, name];
    }

    function handleRowClick(event: MouseEvent, name: string): void {
        if (event.target instanceof Element && event.target.closest("a, button")) return;
        if (window.getSelection()?.toString()) return;
        toggleProject(name);
    }

    async function openFFmpegDirectory(): Promise<void> {
        if (openingDirectory) return;
        openingDirectory = true;
        directoryFailure = "";
        try {
            const result = await window.api.file.openFFmpegDirectory();
            if (!result.success) directoryFailure = describeFailure(result.error);
        }
        catch (error) {
            directoryFailure = describeFailure(toFailureInfo(error));
        }
        finally {
            openingDirectory = false;
        }
    }
</script>