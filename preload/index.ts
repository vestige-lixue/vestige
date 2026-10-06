import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import { type AppAPI } from "../shared/app";
import { appChannels, configChannels, fileChannels, projectChannels } from "../shared/ipc";
import { type ConfigSnapshot } from "../shared/config/Config";
import { executerChannel, cancelExecuterChannel } from "../shared/transcription/executer";

const api: AppAPI = {
    platform: process.platform,
    openDevTools: () => ipcRenderer.send(appChannels.openDevTools),
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
    config: {
        get: () => ipcRenderer.invoke(configChannels.get),
        update: patch => ipcRenderer.invoke(configChannels.update, patch),
        setSidebarWidth: width => ipcRenderer.invoke(configChannels.setSidebarWidth, width),
        updatePlayback: patch => ipcRenderer.invoke(configChannels.updatePlayback, patch),
        save: () => ipcRenderer.invoke(configChannels.save),
        onChanged(callback) {
            const listener = (_event: IpcRendererEvent, snapshot: ConfigSnapshot): void => callback(snapshot);
            ipcRenderer.on(configChannels.changed, listener);
            return () => ipcRenderer.removeListener(configChannels.changed, listener);
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
        selectMediaPaths: () => ipcRenderer.invoke(fileChannels.selectMediaPaths)
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
    }
};

contextBridge.exposeInMainWorld("api", api);