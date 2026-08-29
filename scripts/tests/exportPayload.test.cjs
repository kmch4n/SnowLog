// Compiles the real exportPayload.ts and calls it. See .memory/testing.md for
// why the emit nests under services/ and why the schema imports must stay
// `import type`.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-export-payload-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/services/exportPayload.ts",
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

const {
    backupFileName,
    buildExportPayload,
} = require(path.join(outDir, "services", "exportPayload.js"));

const VIDEO_KEYS = [
    "assetId",
    "capturedAt",
    "createdAt",
    "duration",
    "filename",
    "id",
    "isFavorite",
    "isFileAvailable",
    "memo",
    "skiResortName",
    "tags",
    "techniques",
    "thumbnailUri",
    "title",
    "updatedAt",
];

const DIARY_KEYS = [
    "companions",
    "createdAt",
    "dateKey",
    "expenses",
    "fatigueLevel",
    "impressions",
    "numberOfRuns",
    "skiResortName",
    "snowCondition",
    "temperature",
    "updatedAt",
    "weather",
];

function makeVideoRow(overrides = {}) {
    return {
        id: "v1",
        assetId: "asset-1",
        filename: "IMG_0001.MOV",
        thumbnailUri: "thumbnails/v1.jpg",
        duration: 12,
        capturedAt: 1735689600000,
        skiResortName: "白馬八方尾根",
        memo: "",
        title: null,
        techniques: null,
        isFileAvailable: 1,
        isFavorite: 0,
        createdAt: 1,
        updatedAt: 2,
        ...overrides,
    };
}

function makeDiaryRow(overrides = {}) {
    return {
        id: 3,
        dateKey: "2026-01-15",
        skiResortName: "志賀高原",
        weather: "sunny",
        snowCondition: "powder",
        impressions: "よく走った",
        temperature: -6,
        companions: "ひとり",
        fatigueLevel: 3,
        expenses: 8200,
        numberOfRuns: 14,
        createdAt: 10,
        updatedAt: 11,
        ...overrides,
    };
}

function makeSource(overrides = {}) {
    return {
        videos: [],
        tagsByVideoId: new Map(),
        allTags: [],
        techniqueOptions: [],
        favoriteResorts: [],
        diaryEntries: [],
        preferences: [],
        appVersion: "1.2.0",
        exportedAt: "2026-01-15T00:00:00.000Z",
        ...overrides,
    };
}

test("stamps the schema version, app version and export time", () => {
    const payload = buildExportPayload(makeSource());
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.appVersion, "1.2.0");
    assert.equal(payload.exportedAt, "2026-01-15T00:00:00.000Z");
});

test("an empty library produces every collection as an empty array", () => {
    const payload = buildExportPayload(makeSource());
    assert.deepEqual(payload.videos, []);
    assert.deepEqual(payload.tags, []);
    assert.deepEqual(payload.techniqueOptions, []);
    assert.deepEqual(payload.favoriteResorts, []);
    assert.deepEqual(payload.diaryEntries, []);
    assert.deepEqual(payload.preferences, []);
});

test("techniques is decoded from the JSON column into an array", () => {
    const payload = buildExportPayload(
        makeSource({
            videos: [makeVideoRow({ techniques: '["大回り","コブ"]' })],
        })
    );
    assert.deepEqual(payload.videos[0].techniques, ["大回り", "コブ"]);
});

test("techniques stays null when the column is null or unparseable", () => {
    const payload = buildExportPayload(
        makeSource({
            videos: [
                makeVideoRow({ id: "v1", techniques: null }),
                makeVideoRow({ id: "v2", techniques: "not json" }),
                makeVideoRow({ id: "v3", techniques: "[]" }),
            ],
        })
    );
    assert.deepEqual(
        payload.videos.map((v) => v.techniques),
        [null, null, null]
    );
});

// Both directions. A one-sided assert passes against an inverted comparison.
test("the integer flags become booleans in both directions", () => {
    const payload = buildExportPayload(
        makeSource({
            videos: [
                makeVideoRow({ id: "on", isFavorite: 1, isFileAvailable: 1 }),
                makeVideoRow({ id: "off", isFavorite: 0, isFileAvailable: 0 }),
            ],
        })
    );
    assert.deepEqual(
        payload.videos.map((v) => [v.isFavorite, v.isFileAvailable]),
        [
            [true, true],
            [false, false],
        ]
    );
});

// allTags is deliberately non-empty: with an empty library-wide tag list a
// fallback of `?? source.allTags` would also yield [] and this assert would
// pass against it.
test("a video with no tag entry exports an empty tag array", () => {
    const payload = buildExportPayload(
        makeSource({
            videos: [makeVideoRow()],
            tagsByVideoId: new Map(),
            allTags: [{ id: 1, name: "Powder", type: "custom" }],
        })
    );
    assert.deepEqual(payload.videos[0].tags, []);
    assert.deepEqual(payload.tags, [{ id: 1, name: "Powder", type: "custom" }]);
});

test("per-video tags are attached by video id", () => {
    const payload = buildExportPayload(
        makeSource({
            videos: [makeVideoRow({ id: "a" }), makeVideoRow({ id: "b" })],
            tagsByVideoId: new Map([
                ["a", [{ id: 7, name: "Kenta", type: "skier" }]],
            ]),
        })
    );
    assert.deepEqual(payload.videos[0].tags, [
        { id: 7, name: "Kenta", type: "skier" },
    ]);
    assert.deepEqual(payload.videos[1].tags, []);
});

// A join row carrying videoId leaked into Tag once already (6aecfbe, see
// .memory/testing.md). tagRepository guards it; this is the second line.
test("tags are reduced to id, name and type", () => {
    const payload = buildExportPayload(
        makeSource({
            videos: [makeVideoRow({ id: "a" })],
            tagsByVideoId: new Map([
                ["a", [{ id: 7, name: "Kenta", type: "skier", videoId: "a" }]],
            ]),
            allTags: [{ id: 7, name: "Kenta", type: "skier", videoId: "a" }],
        })
    );
    assert.deepEqual(payload.videos[0].tags, [
        { id: 7, name: "Kenta", type: "skier" },
    ]);
    assert.deepEqual(payload.tags, [{ id: 7, name: "Kenta", type: "skier" }]);
});

// Guards the format against a column added to `videos` later widening the
// backup without a schema version bump.
test("the exported video carries exactly the documented keys", () => {
    const payload = buildExportPayload(makeSource({ videos: [makeVideoRow()] }));
    assert.deepEqual(Object.keys(payload.videos[0]).sort(), VIDEO_KEYS);
});

// Same guard for diary entries, whose row also carries an autoincrement id.
test("the exported diary entry carries exactly the documented keys", () => {
    const payload = buildExportPayload(
        makeSource({ diaryEntries: [makeDiaryRow()] })
    );
    assert.deepEqual(Object.keys(payload.diaryEntries[0]).sort(), DIARY_KEYS);
    assert.equal(payload.diaryEntries[0].numberOfRuns, 14);
});

// The mapping's only effect here is dropping the autoincrement id. Without a
// non-empty case, returning the rows untouched passes every other test.
test("technique options export as name and sortOrder only", () => {
    const payload = buildExportPayload(
        makeSource({
            techniqueOptions: [
                { id: 1, name: "小回り", sortOrder: 2 },
                { id: 2, name: "コブ", sortOrder: 0 },
            ],
        })
    );
    assert.deepEqual(payload.techniqueOptions, [
        { name: "小回り", sortOrder: 2 },
        { name: "コブ", sortOrder: 0 },
    ]);
});

// getFavoriteResorts() returns names, not rows. Pinning the shipped shape.
test("favorite resorts export as a flat array of names", () => {
    const payload = buildExportPayload(
        makeSource({ favoriteResorts: ["白馬八方尾根", "志賀高原"] })
    );
    assert.deepEqual(payload.favoriteResorts, ["白馬八方尾根", "志賀高原"]);
});

// Pins the documented decision so the future importer knows what it may meet.
test("preferences are dumped verbatim, migration bookmarks included", () => {
    const payload = buildExportPayload(
        makeSource({
            preferences: [
                { key: "capturedAt_repair_version", value: "2" },
                { key: "weekStartDay", value: "monday" },
            ],
        })
    );
    assert.deepEqual(payload.preferences, [
        { key: "capturedAt_repair_version", value: "2" },
        { key: "weekStartDay", value: "monday" },
    ]);
});

// Built from local-time getters on a locally-constructed Date, so the
// expectation holds under any TZ. Confirm with TZ=UTC as well.
test("backupFileName formats local date and time, zero padded", () => {
    assert.equal(
        backupFileName(new Date(2026, 0, 5, 9, 7)),
        "snowlog-backup-20260105-0907.json"
    );
    assert.equal(
        backupFileName(new Date(2026, 11, 31, 23, 59)),
        "snowlog-backup-20261231-2359.json"
    );
});
