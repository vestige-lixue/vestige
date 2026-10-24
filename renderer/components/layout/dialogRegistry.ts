import { type Component } from "svelte";
import * as dialogs from "../../states/dialogs.svelte";
import TranscriptionBackends from "../dialogs/TranscriptionBackends.svelte";
import TranscriptionModels from "../dialogs/TranscriptionModels.svelte";
import Vocabulary from "../dialogs/Vocabulary.svelte";
import TranscriptionTasks from "../dialogs/TranscriptionTasks.svelte";
import Settings from "../dialogs/Settings.svelte";
import OpenSourceLicenses from "../dialogs/OpenSourceLicenses.svelte";
import About from "../dialogs/About.svelte";
import UserGuide from "../dialogs/UserGuide.svelte";
import ParameterGuide from "../dialogs/ParameterGuide.svelte";
import TranscriptionConfig from "../dialogs/TranscriptionConfig.svelte";
import SwitchDisplayedRun from "../dialogs/SwitchDisplayedRun.svelte";
import TranscriptionPresets from "../dialogs/TranscriptionPresets.svelte";
import SaveConfirmation from "../dialogs/SaveConfirmation.svelte";
import SaveFailure from "../dialogs/SaveFailure.svelte";
import ProjectBusy from "../dialogs/ProjectBusy.svelte";
import ProjectError from "../dialogs/ProjectError.svelte";
import MediaImportError from "../dialogs/MediaImportError.svelte";
import MediaRefImportError from "../dialogs/MediaRefImportError.svelte";

type CommonProps = { open: boolean; onClosed: (next?: () => void) => void };
type DialogKind = dialogs.ApplicationDialog["kind"];
type DialogOf<Kind extends DialogKind> = dialogs.ApplicationDialog & { kind: Kind };
type PresentedDialog = { component: Component<CommonProps, object, "open">; props: Record<string, unknown> };
type Presenter<Kind extends DialogKind> = (dialog: DialogOf<Kind>) => PresentedDialog;
type PropsOf<View> = View extends Component<infer Props> ? Props : never;

function define<Kind extends DialogKind, View extends Component<never>>(_kind: Kind, component: View,
    props: (dialog: DialogOf<Kind>) => Omit<PropsOf<View>, keyof CommonProps>): Presenter<Kind> {
    return dialog => ({
        // The factory checks each component's required props before erasing them
        // for dynamic rendering; open/onClosed are always supplied by DialogView.
        component: component as unknown as PresentedDialog["component"], props: props(dialog)
    });
}

const registry: { [Kind in DialogKind]: Presenter<Kind> } = {
    "transcription-backends": define("transcription-backends", TranscriptionBackends, dialog => ({ dialogId: dialog.id })),
    "transcription-models": define("transcription-models", TranscriptionModels, dialog => ({ dialogId: dialog.id })),
    vocabulary: define("vocabulary", Vocabulary, () => ({})),
    settings: define("settings", Settings, dialog => ({ dialogId: dialog.id })),
    guide: define("guide", UserGuide, () => ({})),
    "parameter-guide": define("parameter-guide", ParameterGuide, () => ({})),
    licenses: define("licenses", OpenSourceLicenses, () => ({})),
    about: define("about", About, () => ({})),
    tasks: define("tasks", TranscriptionTasks, dialog => ({
        tasks: dialog.getTasks(), focusTaskId: dialog.focusTaskId, onStop: dialog.onStop, onRetry: dialog.onRetry, onRemove: dialog.onRemove
    })),
    transcription: define("transcription", TranscriptionConfig, dialog => ({ dialogId: dialog.id, mediaId: dialog.mediaId })),
    "switch-displayed-run": define("switch-displayed-run", SwitchDisplayedRun, dialog => ({ onConfirm: dialog.onConfirm })),
    "transcription-presets": define("transcription-presets", TranscriptionPresets, dialog => ({
        dialogId: dialog.id, selectedName: dialog.selectedName, onApply: dialog.onApply
    })),
    "save-confirmation": define("save-confirmation", SaveConfirmation, dialog => ({ fileName: dialog.fileName, answer: dialog.answer })),
    "save-failure": define("save-failure", SaveFailure, dialog => ({ fileName: dialog.fileName, error: dialog.error, answer: dialog.answer })),
    "project-busy": define("project-busy", ProjectBusy, dialog => ({ operation: dialog.getOperation() })),
    "project-error": define("project-error", ProjectError, dialog => ({ error: dialog.error })),
    "media-import-error": define("media-import-error", MediaImportError, dialog => ({ failure: dialog.failure })),
    "media-ref-import-error": define("media-ref-import-error", MediaRefImportError, dialog => ({
        issue: dialog.issue, onRetry: dialog.onRetry, onRelink: dialog.onRelink, onIgnore: dialog.onIgnore
    }))
};

function presenter<Kind extends DialogKind>(kind: Kind): Presenter<Kind> {
    return registry[kind];
}

export function presentDialog(dialog: dialogs.ApplicationDialog): PresentedDialog {
    return presenter(dialog.kind)(dialog);
}