import { type Token } from "./Token";
import { type Range } from "../util/range";
import { type Config } from "./Config";

export type TranscriptSpan = {
    range: Range;
    blankProb: number;
    token: Token;
};

export type Run = {
    id: string;
    startedAt: number;
    config: Config;
    language: string;
    languageProb: number;
    // IRL time taken to run the transcription, in seconds.
    runTime: number;
    transcript: TranscriptSpan[];
};