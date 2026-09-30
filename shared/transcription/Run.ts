import { type Token } from "../util/Token";
import { type Range } from "../util/range";

export type Segment = {
    range: Range;
    blankProb: number;
    token: Token;
};

export type Run = {
    id: string;
    modelName: string;
    params: string;
    language: string;
    languageProb: number;
    // IRL time taken to run the transcription, in seconds.
    runTime: number;
    transcript: Segment[];
};