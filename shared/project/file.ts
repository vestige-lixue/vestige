import { type FailureInfo } from "../failure";
import { type Project } from "./Project";

export const projectExtensionPattern = /\.vestige$/i;

export function isProjectFile(pathOrName: string): boolean {
    return projectExtensionPattern.test(pathOrName);
}

export const mediaPathModes = ["absolute", "project", "relative"] as const;
export type MediaPathMode = typeof mediaPathModes[number];

export type GetProjectResult = ({
    success: true;
    project: Project;
} | {
    success: false;
    error: FailureInfo;
});

// Cached JSON crosses the context bridge and IPC without cloning individual tokens and edits.
export type ProjectSaveSnapshot = Omit<Project, "vestiges"> & {
    vestiges: (Omit<Project["vestiges"][number], "runs" | "modifications"> & { runs: string[]; modifications: string })[];
};

export type SaveProjectResult = ({
    success: true;
} | {
    success: false;
    error: FailureInfo;
});

export type CheckProjectFileResult = ({
    success: true;
    exists: boolean;
} | {
    success: false;
    error: FailureInfo;
});