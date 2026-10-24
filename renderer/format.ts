export function formatDuration(seconds: number, { precision = 0, rounding = "round" }: {
    precision?: 0 | 1 | 2 | 3;
    rounding?: "round" | "floor";
} = {}): string {
    const scale = 10 ** precision;
    const total = Math[rounding]((Number.isFinite(seconds) ? Math.max(0, seconds) : 0) * scale);
    // Round the whole duration first so seconds/minutes carry into the next unit.
    const wholeSeconds = Math.floor(total / scale);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainder = String(wholeSeconds % 60).padStart(2, "0");
    const fraction = precision ? `.${String(total % scale).padStart(precision, "0")}` : "";
    const time = `${String(minutes % 60).padStart(2, "0")}:${remainder}${fraction}`;
    return minutes < 60 ? time : `${Math.floor(minutes / 60)}:${time}`;
}