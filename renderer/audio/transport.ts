export type SeekMode = "preview" | "commit";
type SeekRequest = { time: number; mode: SeekMode };
type Seeker = {
    element: HTMLMediaElement;
    pending: SeekRequest | null;
    active: number | null;
    last: number;
    timer: ReturnType<typeof setTimeout> | undefined;
    recovering: boolean;
    settled: () => void;
    failed: (element: HTMLMediaElement) => void;
    detach: () => void;
};
type Run = ({ kind: "audio" } | { kind: "lead"; at: number; position: number; seconds: number } | { kind: "tail"; at: number; position: number; seconds: number });

export type Transport = {
    readonly audio: HTMLMediaElement;
    readonly video: HTMLVideoElement | null;
    readonly audioSeek: Seeker;
    readonly videoSeek: Seeker | null;
    readonly options: {
        duration: number;
        resumeAudio: () => Promise<void>;
        pauseAudio: () => void;
        drainSeconds: () => number;
        onTime: (time: number, remember: boolean) => void;
        onEnded: () => void;
        onInterruption: () => void;
        onError: (element: HTMLMediaElement) => void;
        onClamp: (time: number, mode: SeekMode) => void;
    };
    readonly expectedPauses: WeakMap<HTMLMediaElement, number>;
    detach: () => void;
    timer: ReturnType<typeof setInterval> | undefined;
    frame: number | null;
    position: number;
    speed: number;
    offset: number;
    playing: boolean;
    seeking: boolean;
    mode: SeekMode;
    seekedToEnd: boolean;
    disposed: boolean;
    starting: boolean;
    waiting: boolean;
    generation: number;
    run: Run | null;
    floor: number;
    tailPosition: number | null;
    tailSeconds: number;
    publishedAt: number;
};

// Every native element permits one seek in flight, including drift correction.
function createSeeker(element: HTMLMediaElement, settled: () => void, failed: (element: HTMLMediaElement) => void): Seeker {
    const seeker: Seeker = { element, pending: null, active: null, last: -Infinity, timer: undefined, recovering: false, settled, failed, detach: () => {} };
    const metadata = (): void => applySeek(seeker);
    const seeked = (): void => {
        if (element.seeking) return;
        seeker.active = null;
        applySeek(seeker);
    };
    const error = (): void => {
        // Chromium can fail a valid FLAC tail seek. Reload once, retaining the latest request.
        if (seeker.active !== null && !seeker.recovering) {
            seeker.recovering = true;
            seeker.pending ??= { time: seeker.active, mode: "commit" };
            seeker.active = null;
            seeker.last = -Infinity;
            clearTimeout(seeker.timer);
            element.load();
        }
        else failed(element);
    };
    element.addEventListener("loadedmetadata", metadata);
    element.addEventListener("seeked", seeked);
    element.addEventListener("error", error);
    seeker.detach = () => {
        clearTimeout(seeker.timer);
        element.removeEventListener("loadedmetadata", metadata);
        element.removeEventListener("seeked", seeked);
        element.removeEventListener("error", error);
    };
    return seeker;
}

function requestSeek(seeker: Seeker, time: number, mode: SeekMode): void {
    seeker.pending = { time, mode };
    applySeek(seeker);
}

function applySeek(seeker: Seeker): void {
    clearTimeout(seeker.timer);
    seeker.timer = undefined;
    const { element, pending } = seeker;
    if (element.readyState < 1 || element.seeking || seeker.active !== null) return;
    if (pending) {
        const time = Math.max(0, Number.isFinite(element.duration) ? Math.min(pending.time, element.duration) : pending.time);
        if (Math.abs(element.currentTime - time) >= 0.001) {
            const delay = 75 - (performance.now() - seeker.last);
            if (pending.mode === "preview" && delay > 0) {
                seeker.timer = setTimeout(() => applySeek(seeker), delay);
                return;
            }
            seeker.pending = null;
            seeker.active = time;
            seeker.last = performance.now();
            element.currentTime = time;
            return;
        }
        seeker.pending = null;
    }
    seeker.recovering = false;
    seeker.settled();
}

function isSettled(seeker: Seeker): boolean {
    return seeker.element.readyState >= 1 && !seeker.element.seeking && seeker.active === null && seeker.pending === null;
}

export function create(audio: HTMLMediaElement, video: HTMLVideoElement | null, options: Transport["options"]): Transport {
    const transport: Transport = {
        audio, video, options,
        audioSeek: createSeeker(audio, () => settle(transport), options.onError),
        videoSeek: video ? createSeeker(video, () => settle(transport), options.onError) : null,
        expectedPauses: new WeakMap(), detach: () => {}, timer: undefined, frame: null,
        position: 0, speed: 1, offset: 0, playing: false, seeking: true, mode: "commit", seekedToEnd: false,
        disposed: false, starting: false, waiting: false, generation: 0, run: null, floor: 0,
        tailPosition: null, tailSeconds: 0, publishedAt: -Infinity
    };
    const canPlay = (event: Event): void => {
        if (event.currentTarget === audio) transport.waiting = false;
        begin(transport);
    };
    const waiting = (): void => {
        transport.waiting = true; synchronizeVideo(transport);
    };
    const ended = (): void => {
        if (transport.disposed || transport.seeking || transport.seekedToEnd || !audio.ended) return;
        startTail(transport);
    };
    const paused = (): void => {
        const expected = transport.expectedPauses.get(audio) ?? 0;
        if (expected) transport.expectedPauses.set(audio, expected - 1);
        if (expected || transport.disposed || !audio.paused || !transport.playing || transport.seeking || transport.audioSeek.recovering || audio.ended || audio.currentTime >= duration(transport)) return;
        options.onInterruption();
    };
    audio.addEventListener("canplay", canPlay);
    audio.addEventListener("playing", canPlay);
    audio.addEventListener("waiting", waiting);
    audio.addEventListener("ended", ended);
    audio.addEventListener("pause", paused);
    video?.addEventListener("canplay", canPlay);
    transport.detach = () => {
        audio.removeEventListener("canplay", canPlay);
        audio.removeEventListener("playing", canPlay);
        audio.removeEventListener("waiting", waiting);
        audio.removeEventListener("ended", ended);
        audio.removeEventListener("pause", paused);
        video?.removeEventListener("canplay", canPlay);
    };
    if (video) video.muted = true;
    return transport;
}

function duration(transport: Transport): number {
    return Number.isFinite(transport.audio.duration) ? transport.audio.duration : transport.options.duration;
}

function pauseElement(transport: Transport, element: HTMLMediaElement): void {
    if (!element.paused) transport.expectedPauses.set(element, (transport.expectedPauses.get(element) ?? 0) + 1);
    element.pause();
}

export function getTime(transport: Transport): number {
    const { run, speed } = transport;
    if (run && !transport.seeking) {
        const time = run.kind === "audio" ? transport.audio.currentTime + transport.offset * speed
            : run.position + (performance.now() - run.at) / 1000 * speed;
        transport.position = Math.min(duration(transport), Math.max(transport.floor, time));
    }
    return transport.position;
}

function clearRun(transport: Transport): void {
    transport.generation++;
    transport.starting = false;
    transport.run = null;
    clearInterval(transport.timer);
    transport.timer = undefined;
    if (transport.video && transport.frame !== null) transport.video.cancelVideoFrameCallback(transport.frame);
    transport.frame = null;
}

function freeze(transport: Transport): void {
    getTime(transport);
    if (transport.run?.kind === "tail") {
        const elapsed = (performance.now() - transport.run.at) / 1000;
        transport.tailPosition = transport.run.position + elapsed * transport.speed;
        transport.tailSeconds = Math.max(0, transport.run.seconds - elapsed);
    }
    clearRun(transport);
    pauseElement(transport, transport.audio);
    if (transport.video) pauseElement(transport, transport.video);
    transport.options.pauseAudio();
}

export function setPlaying(transport: Transport, playing: boolean): void {
    if (transport.disposed) return;
    transport.playing = playing;
    if (playing) begin(transport);
    else {
        freeze(transport);
        publish(transport, true);
    }
}

export function configure(transport: Transport, speed: number, offsetMs: number): void {
    const offset = offsetMs / 1000;
    if (transport.disposed || (transport.speed === speed && transport.offset === offset)) return;
    getTime(transport);
    const now = performance.now();
    const run = transport.run;
    const elapsed = run && run.kind !== "audio" ? (now - run.at) / 1000 : 0;
    const position = run && run.kind !== "audio" ? run.position + elapsed * transport.speed : transport.position;
    const remaining = run && run.kind !== "audio" ? Math.max(0, run.seconds - elapsed) : 0;
    transport.speed = speed;
    transport.offset = offset;
    transport.floor = transport.position;
    transport.audio.playbackRate = speed;
    if (transport.video) transport.video.playbackRate = speed;
    // Re-anchor virtual lead/tail clocks at the new rate without pausing the
    // elements or suspending AudioContext for each slider update.
    if (run && run.kind !== "audio") {
        run.at = now;
        run.position = position;
        run.seconds = run.kind === "lead"
            ? Math.max(0, (transport.audio.currentTime + offset * speed - position) / speed)
            : Math.max(0, (duration(transport) - position) / speed, Math.min(remaining, transport.options.drainSeconds()));
    }
    else if (transport.tailPosition !== null) {
        transport.tailPosition = Math.min(transport.position, duration(transport) + offset * speed);
        transport.tailSeconds = Math.max(0, (duration(transport) - transport.tailPosition) / speed,
            Math.min(transport.tailSeconds, transport.options.drainSeconds()));
    }
    synchronizeVideo(transport);
    begin(transport);
}

export function seek(transport: Transport, time: number, mode: SeekMode): void {
    if (transport.disposed) return;
    // Native seeks already replace the decoder position. Keep a playing media
    // element and AudioContext running, including while preview requests coalesce.
    clearRun(transport);
    transport.position = Math.max(0, Math.min(duration(transport), time));
    transport.floor = transport.position;
    transport.mode = mode;
    transport.seeking = true;
    transport.tailPosition = null;
    transport.tailSeconds = 0;
    transport.seekedToEnd = false;
    // Queue both before either can report that a no-op seek has settled.
    transport.audioSeek.pending = { time: transport.position, mode };
    if (transport.videoSeek) transport.videoSeek.pending = { time: transport.position, mode };
    applySeek(transport.audioSeek);
    if (transport.videoSeek) applySeek(transport.videoSeek);
}

function settle(transport: Transport): void {
    if (transport.disposed || !transport.seeking || !isSettled(transport.audioSeek) || (transport.videoSeek && !isSettled(transport.videoSeek))) return;
    if (transport.position > duration(transport)) {
        transport.options.onClamp(duration(transport), transport.mode);
        return;
    }
    transport.seeking = false;
    transport.seekedToEnd = transport.position >= duration(transport);
    publish(transport, true);
    begin(transport);
}

function begin(transport: Transport): void {
    if (transport.disposed || !transport.playing || transport.seeking || transport.seekedToEnd || transport.starting || transport.run) return;
    if (transport.audio.readyState < 3 || (transport.video && transport.video.readyState < 2)) return;
    transport.starting = true;
    const generation = transport.generation;
    void transport.options.resumeAudio().then(async () => {
        if (transport.disposed || generation !== transport.generation || !transport.playing) return;
        transport.floor = transport.position;
        transport.timer = setInterval(() => update(transport), 20);
        observeFrames(transport);
        if (transport.audio.ended || transport.audio.currentTime >= duration(transport)) startTail(transport);
        else {
            const ahead = transport.audio.currentTime + transport.offset * transport.speed - transport.position;
            if (transport.audio.paused && ahead > 0.001) {
                transport.run = { kind: "lead", at: performance.now(), position: transport.position, seconds: ahead / transport.speed };
            }
            else await startAudio(transport);
        }
    }).catch(() => {
        if (!transport.disposed && generation === transport.generation) transport.options.onInterruption();
    }).finally(() => {
        if (generation === transport.generation) transport.starting = false;
    });
}

async function startAudio(transport: Transport): Promise<void> {
    transport.run = { kind: "audio" };
    transport.floor = transport.position;
    transport.waiting = false;
    if (transport.audio.paused) await transport.audio.play();
}

function startTail(transport: Transport): void {
    if (transport.run?.kind === "tail" || !transport.playing) return;
    const position = transport.tailPosition ?? transport.audio.currentTime + transport.offset * transport.speed;
    const seconds = Math.max(0, (duration(transport) - position) / transport.speed, transport.tailSeconds || transport.options.drainSeconds());
    transport.run = { kind: "tail", at: performance.now(), position, seconds };
}

function publish(transport: Transport, remember = false): void {
    if (!transport.disposed && !transport.seeking && transport.mode !== "preview") transport.options.onTime(getTime(transport), remember);
}

function update(transport: Transport): void {
    if (transport.disposed || !transport.playing) return;
    getTime(transport);
    const { run } = transport;
    if (run && run.kind !== "audio" && (performance.now() - run.at) / 1000 >= run.seconds) {
        if (run.kind === "lead") {
            const generation = transport.generation;
            void startAudio(transport).catch(() => {
                if (!transport.disposed && generation === transport.generation) transport.options.onInterruption();
            });
        }
        else {
            transport.position = duration(transport);
            freeze(transport);
            transport.playing = false;
            publish(transport, true);
            transport.options.onEnded();
            return;
        }
    }
    synchronizeVideo(transport);
    if (performance.now() - transport.publishedAt >= 50) {
        transport.publishedAt = performance.now();
        publish(transport, true);
    }
}

function observeFrames(transport: Transport): void {
    if (!transport.video || transport.disposed || !transport.playing) return;
    transport.frame = transport.video.requestVideoFrameCallback(() => {
        synchronizeVideo(transport);
        observeFrames(transport);
    });
}

function synchronizeVideo(transport: Transport): void {
    const { video, videoSeek, run, speed } = transport;
    if (!video || !videoSeek || !run || transport.seeking || video.readyState < 2) return;
    const position = getTime(transport);
    const advancing = run.kind === "audio"
        ? !transport.audio.paused && !transport.waiting && transport.audio.currentTime + transport.offset * speed >= transport.floor
        : run.position + (performance.now() - run.at) / 1000 * speed >= transport.floor;
    if (!advancing || position >= duration(transport)) {
        pauseElement(transport, video);
        if (isSettled(videoSeek) && Math.abs(video.currentTime - position) > 0.03) requestSeek(videoSeek, position, "commit");
        return;
    }
    if (!isSettled(videoSeek)) return;
    const error = position - video.currentTime;
    if (Math.abs(error) > 0.2) {
        pauseElement(transport, video);
        requestSeek(videoSeek, position, "commit");
        return;
    }
    // Let the video clock run; trim small drift instead of seeking on every frame.
    video.playbackRate = speed * (Math.abs(error) > 0.025 ? 1 + Math.max(-0.05, Math.min(0.05, error * 0.5)) : 1);
    if (video.paused && !video.ended) {
        const generation = transport.generation;
        void video.play().catch(() => {
            if (!transport.disposed && generation === transport.generation) transport.options.onInterruption();
        });
    }
}

export function dispose(transport: Transport): void {
    if (transport.disposed) return;
    freeze(transport);
    transport.disposed = true;
    transport.detach();
    transport.audioSeek.detach();
    transport.videoSeek?.detach();
}