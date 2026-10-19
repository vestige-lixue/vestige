import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import { type AppAPI } from "../shared/app";
import { appChannels, settingsChannels, fileChannels, projectChannels } from "../shared/ipc";
import { type SettingsSnapshot } from "../shared/settings/Settings";
import { executerChannel, cancelExecuterChannel } from "../shared/transcription/executer";
import { taskOutputChannels, type TaskSnapshot } from "../shared/task";
import { documentationChannels } from "../shared/documentation";
import { downloadChannels } from "../shared/downloads";

const api: AppAPI = {
    platform: process.platform,
    ready: () => ipcRenderer.send(appChannels.ready),
    openDevTools: () => ipcRenderer.send(appChannels.openDevTools),
    supportsMica: () => ipcRenderer.invoke(appChannels.supportsMica),
    quit: () => ipcRenderer.send(appChannels.quit),
    edit: action => ipcRenderer.send(appChannels.edit, action),
    beforeQuit(check) {
        const listener = (_event: IpcRendererEvent, id: string): void => {
            Promise.resolve().then(check).then(block => {
                ipcRenderer.send(appChannels.beforeQuitResult, id, block !== false);
            }).catch(error => {
                console.error(error);
                ipcRenderer.send(appChannels.beforeQuitResult, id, true);
            });
        };
        ipcRenderer.on(appChannels.beforeQuit, listener);
        return () => {
            ipcRenderer.removeListener(appChannels.beforeQuit, listener);
        };
    },
    settings: {
        get: () => ipcRenderer.invoke(settingsChannels.get),
        update: patch => ipcRenderer.invoke(settingsChannels.update, patch),
        save: () => ipcRenderer.invoke(settingsChannels.save),
        onChanged(callback) {
            const listener = (_event: IpcRendererEvent, snapshot: SettingsSnapshot): void => callback(snapshot);
            ipcRenderer.on(settingsChannels.changed, listener);
            return () => ipcRenderer.removeListener(settingsChannels.changed, listener);
        }
    },
    file: {
        async getPathForFile(file) {
            const path = webUtils.getPathForFile(file);
            if (!path) return { success: false, error: { kind: "file-not-local", name: file.name } };
            return ipcRenderer.invoke(fileChannels.normalize, path);
        },
        readMedia: (id, path, reference) => ipcRenderer.invoke(fileChannels.readMedia, id, path, reference),
        cancelMediaRead: id => ipcRenderer.send(fileChannels.cancelMediaRead, id),
        getMediaURL: path => ipcRenderer.invoke(fileChannels.getMediaURL, path),
        releaseMediaURL: id => ipcRenderer.invoke(fileChannels.releaseMediaURL, id),
        selectMediaPath: path => ipcRenderer.invoke(fileChannels.selectMediaPath, path),
        selectMediaPaths: () => ipcRenderer.invoke(fileChannels.selectMediaPaths),
        selectDirectory: kind => ipcRenderer.invoke(fileChannels.selectDirectory, kind),
        listDirectories: kind => ipcRenderer.invoke(fileChannels.listDirectories, kind),
        openFFmpegDirectory: () => ipcRenderer.invoke(fileChannels.openFFmpegDirectory)
    },
    transcription: {
        transcribe: (id, request) => ipcRenderer.invoke(executerChannel, id, request),
        cancel: id => ipcRenderer.send(cancelExecuterChannel, id)
    },
    project: {
        getProject: path => ipcRenderer.invoke(projectChannels.get, path),
        saveProject: (path, project) => ipcRenderer.invoke(projectChannels.save, path, project),
        selectOpenPath: () => ipcRenderer.invoke(projectChannels.openDialog),
        selectSavePath: (path, saveAs) => ipcRenderer.invoke(projectChannels.saveDialog, path, saveAs)
    },
    taskOutput: {
        get: id => ipcRenderer.invoke(taskOutputChannels.get, id),
        subscribe(id, callback) {
            const listener = (_event: IpcRendererEvent, snapshot: TaskSnapshot): void => {
                if (snapshot.id === id) callback(snapshot);
            };
            ipcRenderer.on(taskOutputChannels.changed, listener);
            return () => ipcRenderer.removeListener(taskOutputChannels.changed, listener);
        }
    },
    downloads: {
        list: () => ipcRenderer.invoke(downloadChannels.list),
        start: (kind, id) => ipcRenderer.invoke(downloadChannels.start, kind, id),
        cancel: id => ipcRenderer.invoke(downloadChannels.cancel, id),
        openDirectory: kind => ipcRenderer.invoke(downloadChannels.openDirectory, kind)
    },
    documentation: {
        read: (kind, language) => ipcRenderer.invoke(documentationChannels.read, kind, language),
        readLink: (from, href) => ipcRenderer.invoke(documentationChannels.readLink, from, href),
        openExternal: url => ipcRenderer.invoke(documentationChannels.openExternal, url)
    }
};

contextBridge.exposeInMainWorld("api", api);