import { type Vestige } from "../Vestige";

export type Project = {
    version: string;
    lastOpened: number;
    vestiges: Vestige[];
};