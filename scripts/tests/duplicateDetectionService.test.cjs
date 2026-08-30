// Compiles the real duplicateDetectionService.ts and calls it. The module
// type-imports "@/types", so a bare `tsc <file>` fails with TS2307 — hand it a
// self-contained tsconfig with just that path mapping, the same way
// calendarUtils.test.cjs does. See .memory/testing.md.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-duplicate-detection-"));
const outDir = path.join(tmpRoot, "out");
const tsconfigPath = path.join(tmpRoot, "tsconfig.json");
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

fs.writeFileSync(
    tsconfigPath,
    JSON.stringify({
        compilerOptions: {
            outDir,
            module: "commonjs",
            moduleResolution: "node",
            target: "ES2020",
            esModuleInterop: true,
            skipLibCheck: true,
            baseUrl: repoRoot,
            paths: { "@/*": [path.join(repoRoot, "src", "*")] },
            types: [],
        },
        files: [
            path.join(repoRoot, "src", "services", "duplicateDetectionService.ts"),
        ],
    })
);

execFileSync(process.execPath, [tscBin, "--project", tsconfigPath], {
    cwd: repoRoot,
    stdio: "inherit",
});

process.on("exit", () => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test.after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// Type-importing "@/types" roots the emit at src/, so it nests under services/.
const { detectDuplicateCandidates } = require(
    path.join(outDir, "services", "duplicateDetectionService.js")
);

let nextId = 0;

function makeVideo(overrides = {}) {
    nextId += 1;
    return {
        id: `v${nextId}`,
        assetId: `asset-${nextId}`,
        filename: `IMG_${String(nextId).padStart(4, "0")}.MOV`,
        thumbnailUri: "",
        duration: 30,
        capturedAt: 1_700_000_000,
        skiResortName: null,
        memo: "",
        title: null,
        techniques: null,
        isFileAvailable: 1,
        isFavorite: 0,
        createdAt: 0,
        updatedAt: 0,
        tags: [],
        ...overrides,
    };
}

function idsOf(group) {
    return group.videos.map((video) => video.id).sort();
}

test("an empty library produces no groups", () => {
    assert.deepEqual(detectDuplicateCandidates([]), []);
});

test("a lone video never forms a group", () => {
    assert.deepEqual(detectDuplicateCandidates([makeVideo()]), []);
});

test("two unrelated videos do not group", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "alpha.mov", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "b", filename: "bravo.mov", duration: 91, capturedAt: 99999 }),
    ]);
    assert.deepEqual(groups, []);
});

test("an identical pair groups with high confidence", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "IMG_0001.MOV", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "b", filename: "IMG_0001.MOV", duration: 30, capturedAt: 1000 }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(idsOf(groups[0]), ["a", "b"]);
    // duration 0 (+2), capturedAt 0 (+3), exact filename (+3) = 8
    assert.equal(groups[0].similarityScore, 8);
    assert.equal(groups[0].confidence, "high");
    assert.deepEqual(groups[0].reasons, [
        "durationExact",
        "capturedAtExact",
        "filenameNearlyExact",
    ]);
});

test("the same resort adds a point and a reason", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "IMG_0001.MOV", capturedAt: 1000, skiResortName: "志賀高原" }),
        makeVideo({ id: "b", filename: "IMG_0001.MOV", capturedAt: 1000, skiResortName: "志賀高原" }),
    ]);
    assert.equal(groups[0].similarityScore, 9);
    assert.ok(groups[0].reasons.includes("resortExact"));
});

// The reason a filename bucket exists alongside the 60-second window: an exact
// filename match is compared no matter how far apart the two were captured.
test("an exact filename match groups far outside the time window", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "IMG_0001.MOV", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "b", filename: "IMG_0001.MOV", duration: 30, capturedAt: 1000 + 3600 }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(idsOf(groups[0]), ["a", "b"]);
});

// Pins normalizeFilename: extension, "(n)" suffix and trailing copy markers all
// come off before comparison.
//
// The capturedAt values are deliberately far apart and the durations differ.
// With them identical, durationDiff 0 (+2) and capturedAtDiff 0 (+3) reach the
// bare score>=5 shortcut on their own, so the group forms whatever the
// filenames normalise to and the assertion proves nothing — verified by
// deleting stripTrailingCopyMarkers and watching it stay green. Spread out,
// the only path to a match is the exact-filename bucket.
test("copy markers, indices and extensions are normalised away", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "IMG_0001.MOV", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "b", filename: "IMG_0001 copy.mov", duration: 31, capturedAt: 5000 }),
        makeVideo({ id: "c", filename: "IMG_0001(1).mov", duration: 32, capturedAt: 9000 }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(idsOf(groups[0]), ["a", "b", "c"]);
});

// The bare `score >= 5` disjunct, isolated. Both shortcuts are deliberately
// off: the filenames are similar but not identical, and durationDiff is 2, so
// neither `exactFilenameMatch && durationDiff <= 2` nor
// `capturedAtDiff <= 5 && durationDiff <= 1` can fire. The pair matches only
// because +3 (same capture time) +1 (similar filename) +1 (same resort) = 5.
// Without this case nothing in the suite exercises that branch at all.
test("a pair reaches the threshold on score alone, with neither shortcut", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({
            id: "a",
            filename: "IMG_00012.MOV",
            duration: 30,
            capturedAt: 1000,
            skiResortName: "志賀高原",
        }),
        makeVideo({
            id: "b",
            filename: "IMG_000123.MOV",
            duration: 32,
            capturedAt: 1000,
            skiResortName: "志賀高原",
        }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(idsOf(groups[0]), ["a", "b"]);
    assert.equal(groups[0].similarityScore, 5);
    assert.ok(groups[0].reasons.includes("filenameSimilar"));
});

// 60 seconds apart is inside the comparison window but scores only 3
// (+2 duration, +1 capturedAt), below the threshold of 5, and neither
// shortcut applies. Pins the boundary in both directions with the next case.
test("sixty seconds apart with identical duration does not match", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "alpha.mov", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "b", filename: "bravo.mov", duration: 30, capturedAt: 1060 }),
    ]);
    assert.deepEqual(groups, []);
});

test("five seconds apart with identical duration matches on the shortcut", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "alpha.mov", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "b", filename: "bravo.mov", duration: 30, capturedAt: 1005 }),
    ]);
    assert.equal(groups.length, 1);
    // duration 0 (+2), capturedAt <=5 (+2) = 4, below the score threshold —
    // it matches only because of the capturedAt/duration shortcut.
    assert.equal(groups[0].similarityScore, 4);
    assert.equal(groups[0].confidence, "medium");
});

// Connected components: a~b and b~c put all three in one group even though
// a and c never matched each other.
test("transitively related videos land in a single group", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "alpha.mov", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "b", filename: "bravo.mov", duration: 30, capturedAt: 1004 }),
        makeVideo({ id: "c", filename: "charlie.mov", duration: 30, capturedAt: 1008 }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(idsOf(groups[0]), ["a", "b", "c"]);
});

// When the pairs in a group agree on nothing, the shared-reason list is empty
// and the group falls back to the mixed label.
test("a group whose pairs share no reason falls back to the mixed label", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "a", filename: "IMG_0001.MOV", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "b", filename: "IMG_0001.MOV", duration: 32, capturedAt: 5000 }),
        makeVideo({ id: "c", filename: "other.mov", duration: 31, capturedAt: 5001 }),
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(idsOf(groups[0]), ["a", "b", "c"]);
    assert.deepEqual(groups[0].reasons, ["mixed"]);
});

test("videos inside a group are newest first", () => {
    const groups = detectDuplicateCandidates([
        makeVideo({ id: "old", filename: "IMG_0001.MOV", capturedAt: 1000 }),
        makeVideo({ id: "new", filename: "IMG_0001.MOV", capturedAt: 2000 }),
    ]);
    assert.deepEqual(
        groups[0].videos.map((video) => video.id),
        ["new", "old"]
    );
});

test("groups are ordered by similarity score, highest first", () => {
    const groups = detectDuplicateCandidates([
        // weak pair: matches on the shortcut only, score 4
        makeVideo({ id: "w1", filename: "weak-one.mov", duration: 30, capturedAt: 1000 }),
        makeVideo({ id: "w2", filename: "weak-two.mov", duration: 30, capturedAt: 1005 }),
        // strong pair: identical, score 8
        makeVideo({ id: "s1", filename: "IMG_9999.MOV", duration: 30, capturedAt: 90000 }),
        makeVideo({ id: "s2", filename: "IMG_9999.MOV", duration: 30, capturedAt: 90000 }),
    ]);
    assert.equal(groups.length, 2);
    assert.deepEqual(idsOf(groups[0]), ["s1", "s2"]);
    assert.deepEqual(idsOf(groups[1]), ["w1", "w2"]);
    assert.ok(groups[0].similarityScore > groups[1].similarityScore);
});

// Deliberately NOT tested: that `reasons` is capped at four entries. The cap in
// `sharedReasons.slice(0, 4)` is unreachable — each of the four scoring
// categories (duration, capturedAt, filename, resort) contributes at most one
// reason per pair, and intersectReasons only ever shrinks the list, so five is
// structurally impossible. An assert on it can never fail, and a test that
// cannot fail is worse than no test.
