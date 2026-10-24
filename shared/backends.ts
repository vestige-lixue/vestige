import { type Executor } from "./transcription/executor";

// A downloadable native implementation of an executor's command/result contract.
export type Backend = {
    id: string;
    name: string;
    executor: Executor;
};