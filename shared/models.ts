import { type Executor } from "./transcription/executor";

export type Model = {
    id: string;
    name: string;
    executor: Executor;
};