import { type BrowserWindow } from "electron";
import { vocabularyChannels } from "../../shared/vocabulary/ipc";
import { handle } from "../util/ipc";
import { selectVocabularySavePath, selectVocabularyImportPath } from "../ui/fileDialogs";
import { type VocabularyStore } from "./store";

export function registerVocabularyIPCs(window: BrowserWindow, store: VocabularyStore): void {
    const contents = window.webContents;
    handle(contents, vocabularyChannels.get, () => store.get());
    handle(contents, vocabularyChannels.change, (revision, change) => store.change(revision, change));
    handle(contents, vocabularyChannels.importRules, revision => store.importRules(revision, () => selectVocabularyImportPath(window)));
    handle(contents, vocabularyChannels.exportRules, revision => store.exportRules(revision, () => selectVocabularySavePath(window, "export")));
    handle(contents, vocabularyChannels.backupAndReset, revision => store.backupAndReset(revision, () => selectVocabularySavePath(window, "backup")));
    const unsubscribe = store.subscribe(snapshot => {
        if (!contents.isDestroyed()) contents.send(vocabularyChannels.changed, snapshot);
    });
    contents.once("destroyed", unsubscribe);
}