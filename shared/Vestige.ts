import { type Media } from "./Media";
import { type TextRange } from "./util/range";
import { type Run } from "./transcription/Run";

export type Modification = {
    // Original-text range; an empty range inserts at its position.
    range: TextRange;
    // Empty text deletes the range.
    text: string;
};

export type Vestige = {
    media: Media;
    playbackPosition: number;
    runs: Run[];
    displayedRunIdx: number;
    modifications: Modification[];
};