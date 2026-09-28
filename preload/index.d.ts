import type { AppAPI } from "../shared/types/app";

declare global {
    interface Window {
        api: AppAPI;
    }
}