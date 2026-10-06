import * as i18n from "../i18n.svelte";
import { type Failure } from "../../shared/failure";
import * as transcription from "../states/transcription.svelte";

// Presentation only. Call while rendering/deriving; never persist the result in application state.
export function describeFailure(failure: Failure): string {
    switch (failure.kind) {
        case "unexpected": return failure.diagnostic;
        case "media-not-file": return i18n.t("errors.media-not-file");
        case "media-size-changed": return i18n.t("errors.media-size-changed");
        case "media-hash-changed": return i18n.t("errors.media-hash-changed");
        case "media-changed-during-read": return i18n.t("errors.media-changed-during-read");
        case "media-missing": return i18n.t("errors.media-missing");
        case "media-cancelled": return i18n.t("errors.media-cancelled");
        case "media-source-invalidated": return i18n.t("errors.media-source-invalidated");
        case "media-invalid-info": return i18n.t("errors.media-invalid-info");
        case "media-no-streams": return i18n.t("errors.media-no-streams");
        case "media-no-duration": return i18n.t("errors.media-no-duration");
        case "media-timeout": return i18n.t("errors.media-timeout");
        case "media-format": return i18n.t("errors.media-format");
        case "media-invalid-reference": return i18n.t("errors.media-invalid-reference");
        case "media-invalid-check-id": return i18n.t("errors.media-invalid-check-id");
        case "media-invalid-concurrency": return i18n.t("errors.media-invalid-concurrency");
        case "media-invalid-import": return i18n.t("errors.media-invalid-import");
        case "transcription-media-unavailable": return i18n.t("errors.transcription-media-unavailable");
        case "transcription-cancelled": return i18n.t("errors.transcription-cancelled");
        case "transcription-invalid-request": return i18n.t("errors.transcription-invalid-request");
        case "transcription-invalid-id": return i18n.t("errors.transcription-invalid-id");
        case "transcription-params-text": return i18n.t("errors.transcription-params-text");
        case "transcription-params-object": return i18n.t("errors.transcription-params-object");
        case "transcription-param-value": return i18n.t("errors.transcription-param-value");
        case "transcription-param-null": return i18n.t("errors.transcription-param-null");
        case "audio-invalid-wave": return i18n.t("errors.audio-invalid-wave");
        case "audio-truncated-wave": return i18n.t("errors.audio-truncated-wave");
        case "audio-empty-wave": return i18n.t("errors.audio-empty-wave");
        case "config-invalid-update": return i18n.t("errors.config-invalid-update");
        case "config-invalid-playback": return i18n.t("errors.config-invalid-playback");
        case "config-invalid-sidebar-width": return i18n.t("errors.config-invalid-sidebar-width");
        case "path-not-absolute": return i18n.t("errors.path-not-absolute");
        case "path-drive-relative": return i18n.t("errors.path-drive-relative");
        case "project-path-not-file": return i18n.t("errors.project-path-not-file");
        case "ipc-not-main-frame": return i18n.t("errors.ipc-not-main-frame");
        case "native-not-found":
            return i18n.t("errors.native-not-found", failure);
        case "native-output-limit": return i18n.t("errors.native-output-limit", failure);
        case "native-spawn-failed": return failure.diagnostic;
        case "native-failed": return failure.diagnostic || i18n.t("errors.native-failed", { reason: failure.signal ?? failure.exitCode });
        case "media-playback-failed": return failure.diagnostic || i18n.t("errors.media-playback-failed");
        case "drop-unreadable":
            return failure.diagnostic
                ? i18n.t(failure.entry === "directory" ? "errors.drop-directory-diagnostic" : "errors.drop-file-diagnostic", failure)
                : i18n.t(failure.entry === "directory" ? "errors.drop-directory" : "errors.drop-file");
        case "file-not-local": return i18n.t("errors.file-not-local", failure);
        case "transcription-unknown-executer": return i18n.t("errors.transcription-unknown-executer", failure);
        case "transcription-empty-path": return i18n.t("errors.transcription-empty-path", failure);
        case "transcription-invalid-json": case "project-invalid-json": return failure.diagnostic;
        case "transcription-invalid-result": return failure.diagnostic || i18n.t("errors.transcription-invalid-result");
        case "transcription-invalid-option": return i18n.t("errors.transcription-invalid-option", failure);
        case "transcription-managed-option": return i18n.t("errors.transcription-managed-option", failure);
        case "transcription-invalid-output":
            switch (failure.field) {
                case "transcription": return i18n.t("errors.transcription-output-array", failure);
                case "text": return i18n.t("errors.transcription-output-text", failure);
                case "segment.text": return i18n.t("errors.transcription-output-segment", failure);
            }
            break;
        case "project-invalid-structure": return i18n.t("errors.project-invalid-structure", failure);
        case "project-invalid-number": return i18n.t(failure.integer ? "errors.project-invalid-integer" : "errors.project-invalid-number", failure);
        case "project-version": return i18n.t("errors.project-version", failure);
        case "project-invalid-uuid": return i18n.t("errors.project-invalid-uuid", failure);
        case "project-duplicate-media": return i18n.t("errors.project-duplicate-media", failure);
        case "project-invalid-path": return i18n.t("errors.project-invalid-path", failure);
        case "project-reversed-range": return i18n.t("errors.project-reversed-range", failure);
    }
    const exhaustive: never = failure;
    throw new Error("Unknown failure: " + JSON.stringify(exhaustive));
}

export function transcriptionLabel(action: transcription.TranscriptionAction): string {
    switch (action) {
        case "start": return i18n.t("transcription.start");
        case "continue": return i18n.t("transcription.continue");
        case "review-failure": return i18n.t("transcription.review-failure");
        case "cancel-queued": return i18n.t("transcription.cancel-queued");
        case "stopping": return i18n.t("transcription.stopping");
        case "stop": return i18n.t("transcription.stop");
    }
}