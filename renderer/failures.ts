import { type ParseKeys } from "i18next";
import * as i18n from "./i18n.svelte";
import { type FailureInfo } from "../shared/failure";

const failureKeys = {
    "media-not-file": "errors.media.notFile",
    "media-size-changed": "errors.media.sizeChanged",
    "media-hash-changed": "errors.media.hashChanged",
    "media-changed-during-read": "errors.media.changedDuringRead",
    "media-missing": "errors.media.missing",
    "media-cancelled": "errors.media.cancelled",
    "media-source-invalidated": "errors.media.sourceInvalidated",
    "media-invalid-info": "errors.media.invalidInfo",
    "media-no-streams": "errors.media.noStreams",
    "media-no-duration": "errors.media.noDuration",
    "media-timeout": "errors.media.timeout",
    "media-format": "errors.media.format",
    "media-invalid-reference": "errors.media.invalidReference",
    "media-invalid-check-id": "errors.media.invalidCheckId",
    "media-invalid-concurrency": "errors.media.invalidConcurrency",
    "media-invalid-import": "errors.media.invalidImport",
    "transcription-media-unavailable": "errors.transcription.mediaUnavailable",
    "transcription-cancelled": "errors.transcription.cancelled",
    "transcription-invalid-request": "errors.transcription.invalidRequest",
    "transcription-invalid-id": "errors.transcription.invalidId",
    "transcription-params-text": "errors.transcription.paramsText",
    "transcription-params-object": "errors.transcription.paramsObject",
    "transcription-param-value": "errors.transcription.paramValue",
    "transcription-param-null": "errors.transcription.paramNull",
    "transcription-empty-result": "errors.transcription.emptyResult",
    "transcription-truncated-output": "errors.transcription.truncatedOutput",
    "transcription-unstable-output": "errors.transcription.unstableOutput",
    "audio-invalid-wave": "errors.audio.invalidWave",
    "audio-truncated-wave": "errors.audio.truncatedWave",
    "audio-empty-wave": "errors.audio.emptyWave",
    "settings-invalid-update": "errors.settings.invalidUpdate",
    "path-not-absolute": "errors.path.notAbsolute",
    "path-drive-relative": "errors.path.driveRelative",
    "project-path-not-file": "errors.project.pathNotFile",
    "ipc-not-main-frame": "errors.ipc.notMainFrame",
    "native-not-found": "errors.native.notFound",
    "native-output-limit": "errors.native.outputLimit",
    "media-playback-failed": "errors.media.playbackFailed",
    "file-not-local": "errors.file.notLocal",
    "transcription-unknown-executor": "errors.transcription.unknownExecutor",
    "transcription-empty-path": "errors.transcription.emptyPath",
    "transcription-invalid-result": "errors.transcription.invalidResult",
    "transcription-invalid-option": "errors.transcription.invalidOption",
    "transcription-managed-option": "errors.transcription.managedOption",
    "project-invalid-structure": "errors.project.invalidStructure",
    "project-version": "errors.project.version",
    "project-invalid-uuid": "errors.project.invalidUuid",
    "project-duplicate-media": "errors.project.duplicateMedia",
    "project-invalid-path": "errors.project.invalidPath",
    "project-reversed-range": "errors.project.reversedRange"
} as const satisfies Partial<Record<FailureInfo["kind"], ParseKeys>>;

const outputFields = { transcription: "array", text: "text", "segment.text": "segment" } as const;

// Derive display text at the presentation boundary; state only keeps FailureInfo.
export function describeFailure(failure: FailureInfo): string {
    switch (failure.kind) {
        case "unexpected": case "native-spawn-failed": case "transcription-invalid-json": case "project-invalid-json":
            return failure.diagnostic;
        case "native-failed":
            return failure.diagnostic || i18n.t("errors.native.failed", { reason: failure.signal ?? failure.exitCode });
        case "media-playback-failed": case "transcription-invalid-result":
            return failure.diagnostic || i18n.t(failureKeys[failure.kind]);
        case "drop-unreadable":
            return i18n.t(`errors.drop.${failure.entry}${failure.diagnostic ? "Diagnostic" : ""}`, failure);
        case "transcription-invalid-output":
            return i18n.t(`errors.transcription.output.${outputFields[failure.field]}`, failure);
        case "project-invalid-number":
            return i18n.t(failure.integer ? "errors.project.invalidInteger" : "errors.project.invalidNumber", failure);
        default:
            return i18n.t(failureKeys[failure.kind], failure);
    }
}