// The import screen's temporary files for one pick: the staged movie copy and the
// preview JPEG (src/utils/pickScratchFiles.ts, wired in src/app/video-import.tsx).
//
// Before: the preview JPEG was created on every pick and never deleted, and a
// preview that arrived after the user had picked another movie was left behind.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-pick-scratch-"));
test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));
execFileSync(
    process.execPath,
    [
        path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/pickScratchFiles.ts",
        "--outDir", outDir, "--target", "ES2020", "--module", "commonjs", "--skipLibCheck",
    ],
    { cwd: repoRoot, stdio: "inherit" }
);
const { createPickScratchFiles } = require(path.join(outDir, "pickScratchFiles.js"));

function recorder({ failOn = [] } = {}) {
    const deleted = [];
    const files = createPickScratchFiles(async (uri) => {
        deleted.push(uri);
        if (failOn.includes(uri)) throw new Error(`cannot delete ${uri}`);
    });
    return { files, deleted };
}

test("the staged copy and the preview are kept until clear, then both are deleted", async () => {
    const { files, deleted } = recorder();
    assert.equal(await files.keep("cache/video-import/a.mov", true), true);
    assert.equal(await files.keep("cache/VideoThumbnails/a.jpg", true), true);
    assert.deepEqual(deleted, []);

    await files.clear();
    assert.deepEqual(deleted.sort(), ["cache/VideoThumbnails/a.jpg", "cache/video-import/a.mov"]);
});

test("a file from a replaced pick is deleted at once and not kept", async () => {
    const { files, deleted } = recorder();
    assert.equal(await files.keep("cache/VideoThumbnails/old.jpg", false), false);
    assert.deepEqual(deleted, ["cache/VideoThumbnails/old.jpg"]);

    await files.clear();
    assert.deepEqual(deleted, ["cache/VideoThumbnails/old.jpg"], "deleted only once");
});

test("clear deletes each file once; a second clear deletes nothing", async () => {
    const { files, deleted } = recorder();
    await files.keep("a.mov", true);
    await files.clear();
    await files.clear();
    assert.deepEqual(deleted, ["a.mov"]);
});

test("a file kept for the next pick while clear runs survives that clear", async () => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const deleted = [];
    const files = createPickScratchFiles(async (uri) => {
        await gate;
        deleted.push(uri);
    });
    await files.keep("first.mov", true);
    const clearing = files.clear();
    await files.keep("second.mov", true);
    release();
    await clearing;
    assert.deepEqual(deleted, ["first.mov"]);

    await files.clear();
    assert.deepEqual(deleted, ["first.mov", "second.mov"]);
});

test("a failed delete does not stop the other deletes or throw", async () => {
    const { files, deleted } = recorder({ failOn: ["a.mov"] });
    await files.keep("a.mov", true);
    await files.keep("a.jpg", true);
    await files.clear();
    assert.deepEqual(deleted.sort(), ["a.jpg", "a.mov"]);

    assert.equal(await files.keep("stale.jpg", false), false);
});

test("the import screen keeps the preview and the staged copy through pickFiles", () => {
    const source = fs.readFileSync(path.join(repoRoot, "src", "app", "video-import.tsx"), "utf8");
    assert.match(source, /pickFiles\.keep\(stagedUri, !isStale\(\)\)/);
    assert.match(source, /pickFiles\.keep\(preview, !isStale\(\)\)/);
    assert.doesNotMatch(source, /stagedFileUriRef/);
    // The two clear points besides unmount: a new pick and a successful save.
    assert.equal(source.match(/await cleanupPickFiles\(\);/g)?.length, 2);
});
