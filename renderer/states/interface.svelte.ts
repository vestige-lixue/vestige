import { type MediaItemState } from "./media.svelte";

export type ApplicationDialog = ({
    kind: "vocabulary" | "tasks" | "settings";
} | {
    kind: "transcription" | "failure";
    item: MediaItemState;
}) & {
    open: boolean;
};

export const interfaceState = $state<{ dialog: ApplicationDialog | null; pickingMedia: boolean }>({
    dialog: null,
    pickingMedia: false
});