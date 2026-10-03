import { type Media } from "../Media";

export type MediaReference = Pick<Media, "size" | "hash">;

export type MediaIssueStatus = "missing" | "changed" | "unreadable";

export type MediaCheckResult = ({
    status: "available";
    path: Media["path"];
    size: number;
    hash: string;
} | {
    status: MediaIssueStatus;
    error: string;
});

export type MediaSourceHandle = { id: string; url: string };