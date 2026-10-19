import { type Executer } from "./transcription/executer";

export type Model = {
    id: string;
    name: string;
    executer: Executer;
};