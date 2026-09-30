import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import { type AppAPI } from "../shared/app";
import { appChannels, projectChannels } from "../shared/ipc";
import { executerChannel, type TranscriptionResult } from "../shared/transcription/executer";

const api: AppAPI = {
    platform: process.platform,
    openDevTools: () => ipcRenderer.send(appChannels.openDevTools),
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
        getPathForFile: file => webUtils.getPathForFile(file)
    },
    transcription: {
        async transcribe(request) {
            const reply: TranscriptionResult = await ipcRenderer.invoke(executerChannel, request);
            if (!reply.ok) throw new Error(reply.error);
            return reply.run;
        }
    },
    project: {
        getProject: path => ipcRenderer.invoke(projectChannels.get, path),
        saveProject: (path, project) => ipcRenderer.invoke(projectChannels.save, path, project),
        selectOpenPath: () => ipcRenderer.invoke(projectChannels.openDialog),
        selectSavePath: path => ipcRenderer.invoke(projectChannels.saveDialog, path)
    }
};

contextBridge.exposeInMainWorld("api", api);