import { type FailureInfo } from "../failure";
import { type Project } from "./Project";

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