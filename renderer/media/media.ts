import { type Media, type MediaKind } from "../../shared/Media";
import { type HashResult } from "./hash.worker";
import HashWorker from "./hash.worker?worker";

function mediaKind(file: File): MediaKind {
    if (file.type.startsWith("video/") || /\.(mp4|m4v|webm|mov|mkv|avi)$/i.test(file.name)) return "video";
    if (file.type.startsWith("audio/") || /\.(wav|mp3|m4a|aac|flac|ogg|opus|aiff|aif)$/i.test(file.name)) return "audio";
    throw new Error(`Unsupported media file: ${file.name}`);
}

async function mediaDuration(file: File, kind: MediaKind): Promise<number> {
    const element = document.createElement(kind);
    const url = URL.createObjectURL(file);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await new Promise<number>((resolve, reject) => {
            element.onloadedmetadata = () => {
                if (Number.isFinite(element.duration) && element.duration >= 0) resolve(element.duration);
                else reject(new Error(`Cannot determine media duration: ${file.name}`));
            };
            element.onerror = () => reject(new Error(`Cannot read this media format: ${file.name}`));
            timeout = setTimeout(() => reject(new Error(`Reading media metadata timed out: ${file.name}`)), 15_000);
            element.preload = "metadata";
            element.src = url;
        });
    }
    finally {
        clearTimeout(timeout);
        element.onloadedmetadata = null;
        element.onerror = null;
        element.removeAttribute("src");
        element.load();
        URL.revokeObjectURL(url);
    }
}

export async function getMediaInfo(file: File): Promise<Media> {
    const kind = mediaKind(file);
    const path = window.api.file.getPathForFile(file);
    if (!path) throw new Error(`A local file path is required: ${file.name}`);
    const duration = await mediaDuration(file, kind);
    const worker = new HashWorker();
    try {
        const hash = await new Promise<string>((resolve, reject) => {
            worker.onmessage = ({ data }: MessageEvent<HashResult>) => {
                if (data.success) resolve(data.hash);
                else reject(new Error(data.error));
            };
            worker.onerror = event => reject(new Error(event.message || `Cannot hash media: ${file.name}`));
            worker.onmessageerror = () => reject(new Error(`Cannot read media hash: ${file.name}`));
            worker.postMessage(file);
        });
        return { path, name: file.name, size: file.size, hash, kind, duration };
    }
    finally {
        worker.terminate();
    }
}