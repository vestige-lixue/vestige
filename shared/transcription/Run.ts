import { type DateMilliseconds, type NonNegativeNumber, type Probability } from "../util/Scalar";
import { type Token } from "./Token";
import { type Range } from "../util/range";
import { type Config } from "./Config";
import { type Execution } from "./Execution";

export type TranscriptSpan = {
    range: Range;
    blankProb: Probability;
    token: Token;
};

export type Run = {
    id: string;
    startedAt: DateMilliseconds;
    config: Config;
    execution: Execution;
    language: string;
    languageProb: Probability;
    // IRL time taken to run the transcription, in seconds.
    runTime: NonNegativeNumber;
    transcript: TranscriptSpan[];
};