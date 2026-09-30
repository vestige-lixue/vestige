export type Range = {
    // [0.0, duration] in seconds.
    start: number;
    // Same as above.
    end: number;
};

export type TextPosition = {
    segmentIdx: number;
    offset: number;
};

export type TextRange = {
    start: TextPosition;
    end: TextPosition;
};