import { type FailureInfo } from "../failure";
import { type Media } from "../Media";

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

export function validMediaHash(value: unknown): value is string {
    return typeof value === "string" && /^[0-9a-f]{16}$/.test(value);
}