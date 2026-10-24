import { type NonNegativeInteger, type NonNegativeNumber } from "./util/Scalar";
import { type Media } from "./Media";
import { type TextPosition, type TextRange } from "./util/range";
import { type Run } from "./transcription/Run";

// Positions always refer to the original Run; replacement is an insertion plus a deletion.
export type Modification = {
    type: "insert";
    pos: TextPosition;
    text: string;
} | {
    type: "delete";
    range: TextRange;
};

export type Vestige = {
    media: Media;
    playbackPosition: NonNegativeNumber;
    runs: Run[];
    displayedRunIdx: NonNegativeInteger;
    modifications: Modification[];
};