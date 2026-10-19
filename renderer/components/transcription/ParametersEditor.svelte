<div class="parameters">
    <div class="heading">
        <span>{i18n.t("transcription.parameters.title")}</span>
        <div class="guides">
            <button class="link link-button focusable" onclick={() => showGuide("parameter-guide")}>{i18n.t("transcription.parameters.guide.title")}</button>
            <button class="link link-button focusable" onclick={() => showGuide("guide")}>{i18n.t("guide.title")}</button>
        </div>
    </div>
    <table>
        <thead><tr><th>{i18n.t("transcription.parameters.key.label")}</th><th>{i18n.t("transcription.parameters.value.label")}</th><th></th></tr></thead>
        <tbody bind:this={tableBody}>
            {#each rows as row (row)}
                <tr>
                    <td><input class="focusable" spellcheck={false} autocomplete="off" {disabled}
                        bind:value={() => row.key, value => {
                            row.key = value;
                            publish();
                        }} /></td>
                    <td><input class="focusable" spellcheck={false} autocomplete="off" {disabled}
                        bind:value={() => row.value, value => {
                            row.value = value;
                            publish();
                        }} /></td>
                    <td class="remove">
                        {#if row.key || row.value || rows.indexOf(row) < rows.length - 1}
                            <Tooltip text={i18n.t("transcription.parameters.actions.remove")} side="left" {disabled} onclick={() => remove(row)}>
                                {#snippet child({ props })}
                                    <button {...props} class="icon-button hoverable activable focusable">
                                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                        {@html closeIcon}
                                    </button>
                                {/snippet}
                            </Tooltip>
                        {/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>


<style>
    .parameters {
        min-width: 0;
    }
    .heading {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 16px;
        margin-bottom: 8px;
        font-weight: 600;
    }
    .guides {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
    }
    .link {
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: normal;
    }
    table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        table-layout: fixed;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        overflow: hidden;
    }
    th {
        padding: 8px 10px;
        text-align: left;
        background: var(--c-surface);
        color: var(--c-text-80p);
        font-size: 13px;
        font-weight: 500;
    }
    th:last-child {
        width: 36px;
    }
    td {
        border-top: 1px solid var(--c-border);
        padding: 0;
    }
    td + td {
        border-left: 1px solid var(--c-border);
    }
    input {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        border: 0;
        padding: 10px;
        color: var(--c-text);
        background: var(--c-background);
        user-select: text;
    }
    input.focusable:focus-visible {
        outline-offset: -2px;
    }
    .remove {
        text-align: center;
        border-left: 0;
    }
    .remove button {
        display: inline-grid;
        width: 20px;
        height: 20px;
        color: var(--c-text);
    }
</style>


<script lang="ts">
    import { flushSync, untrack } from "svelte";
    import * as i18n from "../../i18n.svelte";
    import * as dialogs from "../../states/dialogs.svelte";
    import Tooltip from "../util/Tooltip.svelte";
    import closeIcon from "../../../resources/icons/carbon--close.svg?raw";

    type Row = { key: string; value: string };
    type Props = {
        dialogId: string;
        value: Readonly<Record<string, string>>;
        onchange: (value: Record<string, string>) => void;
        disabled?: boolean;
    };
    let { dialogId, value, onchange, disabled = false }: Props = $props();
    let lastText = untrack(() => JSON.stringify(value));
    let rows = $state<Row[]>(untrack(() => readRows(value)));
    let tableBody = $state<HTMLTableSectionElement>();

    $effect(() => {
        const text = JSON.stringify(value);
        if (text !== lastText) {
            lastText = text;
            rows = readRows(value);
        }
    });

    function showGuide(kind: "parameter-guide" | "guide"): void {
        dialogs.show({ kind, parentId: dialogId, onClosed: () => {} });
    }

    function readRows(params: Readonly<Record<string, string>>): Row[] {
        return [...Object.entries(params).map(([key, value]) => ({ key, value })), { key: "", value: "" }];
    }

    function publish(): void {
        if (rows.at(-1)?.key || rows.at(-1)?.value) rows.push({ key: "", value: "" });
        const params = Object.fromEntries(rows.filter(row => row.key || row.value).map(row => [row.key, row.value]));
        lastText = JSON.stringify(params);
        onchange(params);
    }

    function remove(row: Row): void {
        const index = rows.indexOf(row);
        // Unmount the tooltip before moving focus, ahead of the dialog's removal observer.
        flushSync(() => {
            rows = rows.filter(item => item !== row);
            publish();
        });
        tableBody?.rows[Math.min(index, rows.length - 1)]?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    }
</script>