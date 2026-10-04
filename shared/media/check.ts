import { type Media } from "../Media";

export type MediaReference = Pick<Media, "size" | "hash">;

export type MediaIssueStatus = "missing" | "changed" | "unreadable";

export type MediaCheckResult = ({
    status: "ready";
    media: Omit<Media, "id">;
} | {
    status: MediaIssueStatus | "cancelled";
    error: string;
});

export type MediaURLResult = ({
    status: "ready";
    id: string;
    url: string;
} | {
    status: "missing" | "unreadable";
    error: string;
});