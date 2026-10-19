export type Range = {
    // Finite, non-negative seconds. Timestamps may exceed the media duration.
    start: number;
    // Finite seconds, greater than or equal to start.
    end: number;
};

export type TextPosition = {
    // Original displayed Run segment, or transcript.length for the unique EOF position.
    segmentIdx: number;
    // Codepoint offset before a character. EOF always has offset 0.
    offset: number;
};

export type TextRange = {
    // Half-open original-text range [start, end).
    start: TextPosition;
    end: TextPosition;
};