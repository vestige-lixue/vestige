// whisper-cli writes progress callbacks to stderr. A callback can span pipe chunks.
export function whisperProgress(report: (value: number) => void): (chunk: string) => void {
    let pending = "";
    return chunk => {
        pending += chunk;
        const expression = /whisper_print_progress_callback:\s*progress\s*=\s*(\d+(?:\.\d+)?)%/g;
        let consumed = 0;
        for (const match of pending.matchAll(expression)) {
            const percentage = Number(match[1]);
            // The process can still fail or produce an invalid result after its final callback.
            if (percentage >= 0 && percentage < 100) report(percentage / 100);
            consumed = match.index + match[0].length;
        }
        pending = pending.slice(consumed).slice(-4096);
    };
}