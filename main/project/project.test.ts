import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { type Project } from "../../shared/project/Project";
import { projectVersion } from "../../shared/project/constants";
import { getProject, saveProject } from "./file";
import { validateProject } from "./validate";

function project(): Project {
    return {
        version: projectVersion,
        lastOpened: 1,
        vestiges: [{
            media: { path: "/recording.wav", name: "Recording", hash: "abc", size: 1, kind: "audio", duration: 2 },
            runs: [{
                id: "run", modelName: "model", params: "{}", language: "en", languageProb: 1, runTime: 0.1,
                transcript: [{ range: { start: 0, end: 2 }, blankProb: 0, token: { text: "Hello", prob: 1 } }]
            }],
            primaryRunIdx: 0,
            modifications: [{ type: "insert", pos: { segmentIdx: 0, offset: 5 }, text: "!" }]
        }]
    };
}

test("Typia validates the shared project structure before semantic checks", () => {
    assert.doesNotThrow(() => validateProject(project()));
    for (const value of [null, [], {}, { ...project(), vestiges: [null] }, { ...project(), lastOpened: "1" }]) {
        assert.throws(() => validateProject(value));
    }
    const value = project();
    Reflect.deleteProperty(value.vestiges[0].media, "hash");
    assert.throws(() => validateProject(value), /hash/);
    assert.throws(() => validateProject({ ...project(), version: "unsupported" }), /Unsupported project version/);
});

test("project validation retains time, probability and text-position constraints", () => {
    const changes: Array<(value: Project) => void> = [
        value => {
 value.lastOpened = Infinity;
},
        value => {
 value.vestiges[0].media.size = 0.5;
},
        value => {
 value.vestiges[0].runs[0].transcript[0].range.end = 3;
},
        value => {
 value.vestiges[0].runs[0].transcript[0].range = { start: 1, end: 0 };
},
        value => {
 value.vestiges[0].runs[0].transcript[0].token.prob = 2;
},
        value => {
 value.vestiges[0].primaryRunIdx = 1;
},
        value => {
 value.vestiges[0].modifications = [{ type: "insert", pos: { segmentIdx: 0, offset: 6 }, text: "!" }];
},
        value => {
 value.vestiges[0].modifications = [{ type: "delete", range: { start: { segmentIdx: 0, offset: 2 }, end: { segmentIdx: 0, offset: 1 } } }];
}
    ];
    for (const change of changes) {
        const value = project();
        change(value);
        assert.throws(() => validateProject(value));
    }
});

test("queued saves capture each snapshot and recover after a failed write", async () => {
    const root = resolve(tmpdir());
    const directory = await mkdtemp(join(root, "vestige-project-test-"));
    const path = join(directory, "保存 队列.vestige");
    try {
        const value = project();
        const saves = Array.from({ length: 16 }, (_, index) => {
            value.lastOpened = index;
            return saveProject(path, value);
        });
        value.lastOpened = 999;
        assert.ok((await Promise.all(saves)).every(result => result.success));
        assert.equal(JSON.parse(await readFile(path, "utf8")).lastOpened, 15);
        assert.deepEqual(await readdir(directory), ["保存 队列.vestige"]);
        const invalid = { ...project(), lastOpened: -1 };
        assert.equal((await saveProject(path, invalid)).success, false);
        assert.equal((await saveProject(directory, project())).success, false);
        assert.equal((await saveProject(path, project())).success, true);
        assert.equal((await getProject(path)).success, true);
    }
    finally {
        const child = relative(root, directory);
        assert.ok(child && !child.startsWith("..") && !isAbsolute(child));
        await rm(directory, { recursive: true, force: true });
    }
});