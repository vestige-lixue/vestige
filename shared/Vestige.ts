import { type Media } from "./Media";
import { type TextPosition, type TextRange } from "./util/range";
import { type Run } from "./transcription/Run";

export type Modification = ({
    type: "insert";
    pos: TextPosition;
    text: string;
} | {
    type: "replace";
    range: TextRange;
    text: string;
} | {
    type: "delete";
    range: TextRange;
});

export type Modificationkind = Modification["type"];

export type Vestige = {
    media: Media;
    runs: Run[];
    primaryRunIdx: number;
    modifications: Modification[];
};