import { type Media } from "../../shared/Media";

type PlayerState = {
    media: Media | null;
    playing: boolean;
    currentTime: number;
    speed: number;
};

const playerState = $state<PlayerState>({
    media: null,
    playing: false,
    currentTime: 0.0,
    speed: 1.0
});

export function setMedia(media: Media): void {
    playerState.media = media;
    playerState.playing = false;
    playerState.currentTime = 0.0;
}

export function clearMedia(): void {
    playerState.media = null;
    playerState.playing = false;
    playerState.currentTime = 0.0;
}

export function togglePlaying(): void {
    playerState.playing = !playerState.playing;
}

export function setPlaying(playing: boolean): void {
    playerState.playing = playing;
}

export function setCurrentTime(currentTime: number): void {
    playerState.currentTime = currentTime;
}

export function setSpeed(speed: number): void {
    playerState.speed = speed;
}