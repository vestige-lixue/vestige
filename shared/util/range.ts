import { type NonNegativeInteger, type NonNegativeNumber } from "./Scalar";

export type Range = {
    // Finite, non-negative seconds. Timestamps may exceed the media duration.
    start: NonNegativeNumber;
    // Finite seconds, greater than or equal to start.
    end: NonNegativeNumber;
};

export type TextPosition = {
    // Original displayed Run segment, or transcript.length for the unique EOF position.
    segmentIdx: NonNegativeInteger;
    // Codepoint offset before a character. EOF always has offset 0.
    offset: NonNegativeInteger;
};

export type TextRange = {
    // Half-open original-text range [start, end).
    start: TextPosition;
    end: TextPosition;
};