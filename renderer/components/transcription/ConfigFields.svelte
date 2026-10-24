<div class="fields">
    <div class="field">
        <label for={`${id}-executor`}>{i18n.t("transcription.config.executor.label")}</label>
        <DropdownSelector id={`${id}-executor`} items={executorItems} {disabled} value={config.executor} onValueChange={value => {
            if (isExecutor(value)) onchange({ ...config, executor: value });
        }} />
    </div>
    {#each directories as directory (directory.kind)}
        <div class="field">
            <label>{i18n.t(`transcription.config.${directory.kind}Directory.label`)}</label>
            <Combobox id={`${id}-${directory.kind}`} {disabled} items={directory.items} header={`${directory.kind}s /`} bind:input={directory.input}
                value={config[`${directory.kind}Directory`]} onValueChange={value => setDirectory(directory, value)} onOpenChange={open => {
                    if (open) void refreshDirectories(directory);
                }}>
                {#snippet actions()}
                    <button class="folder hoverable activable focusable" disabled={disabled || browsing} onclick={() => void browse(directory)}>
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html folderIcon}
                        {i18n.t("common.browse")}
                    </button>
                {/snippet}
            </Combobox>
        </div>
    {/each}
    <ParametersEditor {dialogId} value={config.params} onchange={params => onchange({ ...config, params })} {disabled} />
    {#if error}<div class="error-message">{describeFailure(error)}</div>{/if}
</div>


<style>
    .fields {
        display: flex;
        flex-direction: column;
        gap: 18px;
        min-width: 0;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
    }
    label {
        font-weight: 600;
    }
    .folder {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-left: 1px solid var(--c-border);
        border-radius: 0 5px 5px 0;
        flex-shrink: 0;
        color: var(--c-text);
    }
    .folder :global(svg) {
        width: 18px;
        height: 18px;
    }
</style>


<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as i18n from "../../i18n.svelte";
    import { type Config } from "../../../shared/transcription/Config";
    import { executors, isExecutor } from "../../../shared/transcription/executor";
    import { type DownloadKind } from "../../../shared/downloads";
    import { toFailureInfo, type FailureInfo } from "../../../shared/failure";
    import { describeFailure } from "../../failures";
    import ParametersEditor from "./ParametersEditor.svelte";
    import Combobox from "../util/Combobox.svelte";
    import DropdownSelector from "../util/DropdownSelector.svelte";
    import folderIcon from "../../../resources/icons/lucide--folder-open.svg?raw";

    type DirectoryField = {
        kind: DownloadKind;
        input: HTMLInputElement | null;
        items: { value: string; label: string }[];
        version: number;
    };
    type Props = {
        dialogId: string;
        config: Config;
        onchange: (config: Config) => void;
        validate?: (requireDirectory?: boolean, report?: boolean) => boolean;
        disabled?: boolean;
    };
    let { dialogId, config, onchange, validate = $bindable(), disabled = false }: Props = $props();
    const id = $props.id();
    const executorItems = executors.map(({ id, name }) => ({ value: id, label: name }));
    const directories = $state<DirectoryField[]>((["backend", "model"] as const).map(kind => ({ kind, input: null, items: [], version: 0 })));
    const emptyDirectoryMessages = { backend: "transcription.config.backendDirectory.required", model: "transcription.config.modelDirectory.required" } as const;
    let browsing = $state(false);
    let error = $state<FailureInfo | null>(null);
    let alive = true;

    onMount(() => {
        validate = check;
        for (const directory of directories) void refreshDirectories(directory);
        return () => validate = undefined;
    });
    onDestroy(() => alive = false);

    function check(requireDirectory = false, report = true): boolean {
        let firstInvalid: DirectoryField | null = null;
        for (const directory of directories) {
            const missing = requireDirectory && !config[`${directory.kind}Directory`].trim();
            directory.input?.setCustomValidity(missing ? i18n.t(emptyDirectoryMessages[directory.kind]) : "");
            if (missing && !firstInvalid) firstInvalid = directory;
        }
        if (report) {
            firstInvalid?.input?.focus();
            firstInvalid?.input?.reportValidity();
        }
        return firstInvalid === null;
    }

    function setDirectory(directory: DirectoryField, value: string): void {
        directory.input?.setCustomValidity("");
        onchange({ ...config, [`${directory.kind}Directory`]: value });
    }

    async function refreshDirectories(directory: DirectoryField): Promise<void> {
        const version = ++directory.version;
        try {
            const result = await window.api.file.listDirectories(directory.kind);
            if (!alive || version !== directory.version) return;
            if (!result.success) {
                error = result.error;
                return;
            }
            directory.items = result.directories.map(name => ({ value: name, label: name }));
        }
        catch (cause) {
            if (alive && version === directory.version) error = toFailureInfo(cause);
        }
    }

    async function browse(directory: DirectoryField): Promise<void> {
        if (disabled || browsing) return;
        browsing = true;
        error = null;
        try {
            const path = await window.api.file.selectDirectory(directory.kind);
            if (path && alive) {
                setDirectory(directory, path);
                void refreshDirectories(directory);
            }
        }
        catch (cause) {
            if (alive) error = toFailureInfo(cause);
        }
        finally {
            if (alive) browsing = false;
        }
    }
</script>