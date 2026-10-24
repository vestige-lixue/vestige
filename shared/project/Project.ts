import { type NonNegativeInteger } from "../util/Scalar";
import { type Vestige } from "../Vestige";
import { type projectVersion } from "./constants";

export type Project = {
    version: typeof projectVersion;
    lastOpened: NonNegativeInteger;
    vestiges: Vestige[];
};