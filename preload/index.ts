import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import { type AppAPI } from "../shared/app";
import { appChannels, fileChannels, projectChannels } from "../shared/ipc";
import { executerChannel, cancelExecuterChannel, type TranscriptionResult } from "../shared/transcription/executer";

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
    file: {
        async getPathForFile(file) {
            const path = webUtils.getPathForFile(file);
            if (!path) throw new Error(`A local file path is required: ${file.name}`);
            return ipcRenderer.invoke(fileChannels.normalize, path);
        },
        readMedia: (id, path, reference) => ipcRenderer.invoke(fileChannels.readMedia, id, path, reference),
        cancelMediaRead: id => ipcRenderer.send(fileChannels.cancelMediaRead, id),
        openMediaSource: path => ipcRenderer.invoke(fileChannels.openMediaSource, path),
        closeMediaSource: id => ipcRenderer.send(fileChannels.closeMediaSource, id),
        selectMediaPath: path => ipcRenderer.invoke(fileChannels.selectMediaPath, path),
        selectMediaPaths: () => ipcRenderer.invoke(fileChannels.selectMediaPaths)
    },
    transcription: {
        async transcribe(id, request) {
            const reply: TranscriptionResult = await ipcRenderer.invoke(executerChannel, id, request);
            if (!reply.ok) throw new Error(reply.error);
            return reply.run;
        },
        cancel: id => ipcRenderer.send(cancelExecuterChannel, id)
    },
    project: {
        getProject: path => ipcRenderer.invoke(projectChannels.get, path),
        saveProject: (path, project) => ipcRenderer.invoke(projectChannels.save, path, project),
        selectOpenPath: () => ipcRenderer.invoke(projectChannels.openDialog),
        selectSavePath: path => ipcRenderer.invoke(projectChannels.saveDialog, path)
    }
};

contextBridge.exposeInMainWorld("api", api);