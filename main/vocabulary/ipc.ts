import { type BrowserWindow } from "electron";
import { vocabularyChannels } from "../../shared/vocabulary/ipc";
import { handle } from "../util/ipc";
import { type VocabularyStore } from "./store";

export function registerVocabularyIPCs(window: BrowserWindow, store: VocabularyStore): void {
    const contents = window.webContents;
    handle(contents, vocabularyChannels.get, () => store.get());
    handle(contents, vocabularyChannels.change, (revision, change) => store.change(revision, change));
    const unsubscribe = store.subscribe(snapshot => {
        if (!contents.isDestroyed()) contents.send(vocabularyChannels.changed, snapshot);
    });
    contents.once("destroyed", unsubscribe);
}