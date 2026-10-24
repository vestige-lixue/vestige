import typia from "typia";
import { type FailureInfo } from "../failure";
import { type Media, type MediaHash } from "../Media";

export type MediaReference = Pick<Media, "size" | "hash">;

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

export const validMediaHash = typia.createIs<MediaHash>();