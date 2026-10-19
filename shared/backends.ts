import { type Executer } from "./transcription/executer";

// A downloadable native implementation of an executer's command/result contract.
export type Backend = {
    id: string;
    name: string;
    executer: Executer;
    program: string;
};