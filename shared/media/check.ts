import { type FailureInfo } from "../failure";
import { type Media } from "../Media";

export type MediaReference = Pick<Media, "size" | "mtimeMs">;

export type MediaIssueStatus = "missing" | "changed" | "unreadable";

export type MediaCheckResult = ({
    status: "ready";
    media: Omit<Media, "id">;
} | {
    status: MediaIssueStatus | "cancelled";
    error: FailureInfo;
});

export type MediaURLResult = ({
    status: "ready";
    id: string;
    url: string;
} | {
    status: "missing" | "unreadable";
    error: FailureInfo;
});