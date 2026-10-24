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