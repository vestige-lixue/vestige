import { type Failure } from "../failure";
import { type Project } from "./Project";

export type GetProjectResult = ({
    success: true;
    project: Project;
} | {
    success: false;
    error: Failure;
});

export type SaveProjectResult = ({
    success: true;
} | {
    success: false;
    error: Failure;
});