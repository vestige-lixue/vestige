import { type Vestige } from "../Vestige";
import { type projectVersion } from "./constants";

export type Project = {
    version: typeof projectVersion;
    lastOpened: number;
    vestiges: Vestige[];
};