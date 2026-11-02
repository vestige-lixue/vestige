import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ParseKeys, type TOptions } from "i18next";
import { mkdtemp, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseBatchResults } from "../main/transcription/sherpa/result";
import { parseResult } from "../main/transcription/result";
import { execute as executeWhisper } from "../main/transcription/whisper/execute";
import { type ExecutionContext } from "../main/transcription/execute";
import * as processes from "../main/util/process";
import { parseAbsolutePath } from "../main/util/file";
import { describeFailure } from "../renderer/failures";
import { type FailureInfo, VestigeErrors, toFailureInfo } from "../shared/failure";
import { project } from "./support/fixtures";

const language = vi.hoisted(() => ({ value: "en" as "en" | "zh-CN" }));

vi.mock("../renderer/i18n.svelte", async () => {
    const { createI18n } = await import("../shared/i18n");
    const instance = createI18n("en");
    return { t: (key: ParseKeys, options?: TOptions): string => instance.t(key, { ...options, lng: language.value }) };
});

const diagnostic = "Started\r\nDone!\r\n";

function captured(operation: () => unknown): VestigeErrors {
    try {
        operation();
    }
    catch (error) {
        expect(error).toBeInstanceOf(VestigeErrors);
        return error as VestigeErrors;
    }
    throw new Error("Expected a transcription failure.");
}

function transported(error: unknown): FailureInfo {
    // Error.cause itself is not part of the plain IPC reply or task log record.
    return JSON.parse(JSON.stringify(toFailureInfo(error))) as FailureInfo;
}

beforeEach(() => {
    language.value = "en";
});

describe.each([
    {
        locale: "en" as const,
        json: "Could not parse the executor's JSON result.",
        read: "Could not read the executor's JSON result file.",
        count: (actual: number): string => `The executor returned ${actual} results instead of 2.`,
        native: "The executor exited with an error.", exit: "Exit code: 7", signal: "Termination signal: SIGTERM",
        output: "Raw executor output:"
    },
    {
        locale: "zh-CN" as const,
        json: "无法解析执行器返回的 JSON 结果。",
        read: "无法读取执行器生成的 JSON 结果文件。",
        count: (actual: number): string => `执行器返回了 ${actual} 条结果，应为 2 条。`,
        native: "执行器异常退出。", exit: "退出码：7", signal: "终止信号：SIGTERM",
        output: "执行器原始输出："
    }
])("$locale failure summaries", labels => {
    beforeEach(() => {
        language.value = labels.locale;
    });

    it.each(["sherpa", "whisper"])("transports the %s JSON parser exception ahead of native output", executor => {
        const error = captured(() => executor === "sherpa"
            ? parseBatchResults("{\"text\":", diagnostic, 1)
            : parseResult("{\"transcription\":", diagnostic));
        expect(error.cause).toBeInstanceOf(SyntaxError);
        const failure = transported(error);
        expect(failure).toMatchObject({
            kind: "transcription-invalid-result", reason: "json", cause: String(error.cause), diagnostic
        });
        expect(describeFailure(failure)).toBe(`${labels.json}\n${String(error.cause)}\n\n${labels.output}\n${diagnostic}`);
    });

    it.each([0, 1, 3])("reports expected and actual result counts when %i results arrive", actual => {
        const raw = Array.from({ length: actual }, () => JSON.stringify({ text: "sample" })).join("\n");
        const error = captured(() => parseBatchResults(raw, diagnostic, 2));
        expect(error.cause).toBeUndefined();
        const failure = transported(error);
        expect(failure).toEqual({ kind: "transcription-invalid-result", reason: "count", expected: 2, actual, diagnostic });
        expect(describeFailure(failure)).toBe(`${labels.count(actual)}\n\n${labels.output}\n${diagnostic}`);
    });

    it.each([
        { exitCode: 7, signal: null },
        { exitCode: null, signal: "SIGTERM" },
        { exitCode: 7, signal: "SIGTERM" }
    ])("keeps exit status visible before diagnostic output: %j", status => {
        const failure = transported(new VestigeErrors({ kind: "native-failed", diagnostic, ...status }));
        const summary = [labels.native, ...(status.exitCode !== null ? [labels.exit] : []), ...(status.signal ? [labels.signal] : [])].join("\n");
        expect(describeFailure(failure)).toBe(`${summary}\n\n${labels.output}\n${diagnostic}`);
    });

    it("omits unavailable exit metadata and empty diagnostic output", () => {
        expect(describeFailure({ kind: "native-failed", exitCode: null, signal: null, diagnostic: null })).toBe(labels.native);
        const failure = transported(captured(() => parseResult("", "")));
        expect(describeFailure(failure)).toMatch(new RegExp(`^${labels.json.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\nSyntaxError:`));
        expect(describeFailure(failure)).not.toContain(labels.output);
    });

    it("distinguishes a missing Whisper result file after a successful process exit", async () => {
        const directory = parseAbsolutePath(await mkdtemp(join(tmpdir(), "vestige-diagnostics-")));
        const run = project().vestiges[0].runs[0];
        const context: ExecutionContext = {
            id: "fixture",
            request: { ...run.execution.request, mediaPath: parseAbsolutePath(run.execution.request.mediaPath), modelDirectory: directory, config: run.config, startedAt: 0 },
            backend: { directory, executable: parseAbsolutePath(process.execPath), tools: {} },
            model: { files: [], options: {}, strategy: { kind: "native" } },
            execution: run.execution, directory, audio: parseAbsolutePath(join(directory, "fixture.wav")), duration: 1,
            vadModelPath: parseAbsolutePath(join(directory, "vad.onnx"))
        };
        const native = vi.spyOn(processes, "runProcess").mockResolvedValueOnce({ stdout: "", stderr: diagnostic });
        try {
            let error: unknown;
            try {
                await executeWhisper(context);
            }
            catch (caught) {
                error = caught;
            }
            expect(error).toBeInstanceOf(VestigeErrors);
            const failure = transported(error);
            expect(failure).toMatchObject({ kind: "transcription-invalid-result", reason: "read", cause: expect.stringContaining("ENOENT"), diagnostic });
            expect(describeFailure(failure).startsWith(labels.read + "\n")).toBe(true);
            expect(describeFailure(failure)).not.toContain(labels.json);
            expect(describeFailure(failure).endsWith(`${labels.output}\n${diagnostic}`)).toBe(true);
        }
        finally {
            native.mockRestore();
            await rmdir(directory);
        }
    });
});

describe("native failure capture", () => {
    it("carries a real process exit code and output through the plain failure reply", async () => {
        let error: unknown;
        try {
            await processes.runProcess(parseAbsolutePath(process.execPath), ["-e", "process.stderr.write(\"native failure\\n\"); process.exitCode = 7;"], parseAbsolutePath(process.cwd()));
        }
        catch (caught) {
            error = caught;
        }
        const failure = transported(error);
        expect(failure).toEqual({ kind: "native-failed", exitCode: 7, signal: null, diagnostic: "native failure\n" });
        expect(describeFailure(failure)).toBe("The executor exited with an error.\nExit code: 7\n\nRaw executor output:\nnative failure\n");
    });

    it("retains raw result output when no native stderr is available", () => {
        const raw = "{\"text\":broken}";
        const error = captured(() => parseBatchResults(raw, "", 1));
        const failure = transported(error);
        expect(failure).toMatchObject({ reason: "json", cause: String(error.cause), diagnostic: raw });
        expect(describeFailure(failure).endsWith(`Raw executor output:\n${raw}`)).toBe(true);
    });
});