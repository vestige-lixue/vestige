import { contextBridge } from "electron";
import type { AppAPI } from "../shared/types/app";

const api: AppAPI = {
    platform: process.platform
};

contextBridge.exposeInMainWorld("api", api);