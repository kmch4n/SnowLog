const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-video-list-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/utils/videoListEquality.ts",
        "--outDir",
        outDir,
        "--target",
        "ES2020",
        "--module",
        "commonjs",
        "--esModuleInterop",
        "--skipLibCheck",
    ],
    { cwd: repoRoot, stdio: "inherit" }
);

process.on("exit", () => {
    fs.rmSync(outDir, { recursive: true, force: true });
});

test.after(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
});

const { areVideoListsEqual } = require(path.join(outDir, "utils", "videoListEquality.js"));

function makeVideo(overrides = {}) {
    return {
        id: "video-1",
        assetId: "asset-1",
        filename: "clip.mov",
        thumbnailUri: "thumb.jpg",
        duration: 12,
        capturedAt: 1_700_000_000,
        skiResortName: "Hakuba",
        memo: "memo",
        title: "Title",
        techniques: ["Carving"],
        isFileAvailable: 1,
        isFavorite: 0,
        createdAt: 1_700_000_100,
        updatedAt: 1_700_000_200,
        tags: [{ id: 1, name: "Powder", type: "custom" }],
        ...overrides,
    };
}

test("areVideoListsEqual keeps equivalent lists stable", () => {
    assert.equal(areVideoListsEqual([makeVideo()], [makeVideo()]), true);
});

test("areVideoListsEqual detects display-affecting video changes", () => {
    assert.equal(
        areVideoListsEqual([makeVideo()], [makeVideo({ isFavorite: 1 })]),
        false
    );
    assert.equal(
        areVideoListsEqual([makeVideo()], [makeVideo({ title: "New title" })]),
        false
    );
});

test("areVideoListsEqual detects tag, technique, and order changes", () => {
    assert.equal(
        areVideoListsEqual(
            [makeVideo()],
            [makeVideo({ tags: [{ id: 2, name: "Park", type: "custom" }] })]
        ),
        false
    );
    assert.equal(
        areVideoListsEqual([makeVideo()], [makeVideo({ techniques: ["Mogul"] })]),
        false
    );
    assert.equal(
        areVideoListsEqual(
            [makeVideo({ id: "video-1" }), makeVideo({ id: "video-2" })],
            [makeVideo({ id: "video-2" }), makeVideo({ id: "video-1" })]
        ),
        false
    );
});
