import { type Settings } from "../settings/Settings";
import { type TextIndex, type TextProjection } from "./text";
import { timeText } from "./export/timing";
import { textLayout } from "./export/breaks";
import { cueRanges } from "./export/cues";
import { writeSrt } from "./export/srt";

export type SrtOptions = Settings["export"]["srt"];

export function exportPlainText(_index: TextIndex, projection: TextProjection): string {
    return projection.text;
}

export function exportSrt(index: TextIndex, projection: TextProjection, duration: number, options: SrtOptions, language?: string): { text: string; unanchored: number; estimated: boolean } {
    const timed = timeText(index, projection, duration), layout = textLayout(timed.text, language);
    return writeSrt(timed, layout, cueRanges(timed, layout, options), duration, options);
}