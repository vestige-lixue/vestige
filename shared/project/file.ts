import { type Project } from "./Project";

export type GetProjectResult = ({
    success: true;
    project: Project;
} | {
    success: false;
    error: string;
});

export type SaveProjectResult = ({
    success: true;
} | {
    success: false;
    error: string;
});