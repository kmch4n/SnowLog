// Compiles the real importPayload.ts and calls it. The module keeps every
// import relative and type-only so a bare `tsc <file>` works; the emit nests
// under services/ because src/types joins the program. See .memory/testing.md.
//
// This parser turns an untrusted file on disk into database rows, so the cases
// below lean on the malformed and the hostile rather than the happy path.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-import-payload-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/services/importPayload.ts",
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
    ImportError,
    RESTORABLE_PREFERENCE_KEYS,
    parseExportPayload,
} = require(path.join(outDir, "services", "importPayload.js"));

function makeBackup(overrides = {}) {
    return {
        schemaVersion: 1,
        appVersion: "1.2.0",
        exportedAt: "2026-01-15T00:00:00.000Z",
        videos: [],
        tags: [],
        techniqueOptions: [],
        favoriteResorts: [],
        diaryEntries: [],
        preferences: [],
        ...overrides,
    };
}

function makeExportedVideo(overrides = {}) {
    return {
        id: "v1",
        assetId: "asset-1",
        filename: "IMG_0001.MOV",
        thumbnailUri: "thumbnails/v1.jpg",
        duration: 12,
        capturedAt: 1735689600,
        skiResortName: "白馬八方尾根",
        memo: "よく走った",
        title: null,
        techniques: ["大回り"],
        isFileAvailable: true,
        isFavorite: false,
        createdAt: 1,
        updatedAt: 2,
        tags: [{ id: 7, name: "Kenta", type: "skier" }],
        ...overrides,
    };
}

test("a minimal valid backup parses to empty collections", () => {
    const plan = parseExportPayload(makeBackup());
    assert.deepEqual(plan.videos, []);
    assert.deepEqual(plan.tags, []);
    assert.deepEqual(plan.techniqueOptions, []);
    assert.deepEqual(plan.favoriteResorts, []);
    assert.deepEqual(plan.diaryEntries, []);
    assert.deepEqual(plan.preferences, []);
});

test("a newer schemaVersion is rejected as newer", () => {
    assert.throws(
        () => parseExportPayload(makeBackup({ schemaVersion: 2 })),
        (error) => error instanceof ImportError && /newer/i.test(error.message)
    );
});

test("a missing or non-numeric schemaVersion is rejected", () => {
    for (const bad of [undefined, "1", null, 0, -1]) {
        assert.throws(
            () => parseExportPayload(makeBackup({ schemaVersion: bad })),
            ImportError,
            `expected rejection for schemaVersion ${JSON.stringify(bad)}`
        );
    }
});

test("a payload that is not an object is rejected", () => {
    for (const bad of [null, undefined, [], "x", 42, true]) {
        assert.throws(
            () => parseExportPayload(bad),
            ImportError,
            `expected rejection for ${JSON.stringify(bad)}`
        );
    }
});

test("a full video row is normalised for the database", () => {
    const plan = parseExportPayload(
        makeBackup({ videos: [makeExportedVideo()] })
    );
    assert.equal(plan.videos.length, 1);
    const video = plan.videos[0];
    assert.equal(video.id, "v1");
    assert.equal(video.assetId, "asset-1");
    assert.equal(video.filename, "IMG_0001.MOV");
    assert.equal(video.thumbnailUri, "thumbnails/v1.jpg");
    assert.equal(video.duration, 12);
    assert.equal(video.capturedAt, 1735689600);
    assert.equal(video.skiResortName, "白馬八方尾根");
    assert.equal(video.memo, "よく走った");
    assert.equal(video.title, null);
    assert.deepEqual(video.techniques, ["大回り"]);
    assert.equal(video.createdAt, 1);
    assert.equal(video.updatedAt, 2);
});

// The export writes real booleans; the column stores 0/1. Both directions,
// because a one-sided assert passes against a constant.
test("exported booleans become integer flags in both directions", () => {
    const plan = parseExportPayload(
        makeBackup({
            videos: [
                makeExportedVideo({ id: "on", assetId: "a-on", isFavorite: true, isFileAvailable: true }),
                makeExportedVideo({ id: "off", assetId: "a-off", isFavorite: false, isFileAvailable: false }),
            ],
        })
    );
    assert.deepEqual(
        plan.videos.map((v) => [v.isFavorite, v.isFileAvailable]),
        [
            [1, 1],
            [0, 0],
        ]
    );
});

test("a video missing a required field is skipped and counted", () => {
    for (const missing of ["id", "assetId", "filename", "capturedAt"]) {
        const row = makeExportedVideo();
        delete row[missing];
        const plan = parseExportPayload(makeBackup({ videos: [row] }));
        assert.deepEqual(plan.videos, [], `expected skip when ${missing} is absent`);
        assert.equal(plan.skipped.videos, 1, `expected a skip count when ${missing} is absent`);
    }
});

// Wrong type is as fatal to a row as absent. A string capturedAt would reach
// an integer column and a numeric id would break the video_tags join.
test("a required field of the wrong type also skips the video", () => {
    for (const [field, value] of [
        ["id", 5],
        ["assetId", null],
        ["filename", 12],
        ["capturedAt", "1735689600"],
    ]) {
        const plan = parseExportPayload(
            makeBackup({ videos: [makeExportedVideo({ [field]: value })] })
        );
        assert.deepEqual(plan.videos, [], `expected skip when ${field} is ${JSON.stringify(value)}`);
        assert.equal(plan.skipped.videos, 1);
    }
});

test("a non-array techniques field becomes null rather than skipping the row", () => {
    const plan = parseExportPayload(
        makeBackup({ videos: [makeExportedVideo({ techniques: "大回り" })] })
    );
    assert.equal(plan.videos.length, 1);
    assert.equal(plan.videos[0].techniques, null);
});

// memo is NOT NULL DEFAULT "" in the schema, so a hand-edited file that drops
// it must not produce a null insert.
test("a missing memo defaults to an empty string", () => {
    const row = makeExportedVideo();
    delete row.memo;
    const plan = parseExportPayload(makeBackup({ videos: [row] }));
    assert.equal(plan.videos[0].memo, "");
});

// Tag ids are local autoincrement values and mean nothing in another database.
test("video tags are carried by name and type, with the stored id dropped", () => {
    const plan = parseExportPayload(
        makeBackup({ videos: [makeExportedVideo()] })
    );
    assert.deepEqual(plan.videos[0].tagRefs, [{ name: "Kenta", type: "skier" }]);
});

test("a video tag with an unknown type is dropped", () => {
    const plan = parseExportPayload(
        makeBackup({
            videos: [
                makeExportedVideo({
                    tags: [
                        { id: 1, name: "good", type: "custom" },
                        { id: 2, name: "bad", type: "nonsense" },
                    ],
                }),
            ],
        })
    );
    assert.deepEqual(plan.videos[0].tagRefs, [{ name: "good", type: "custom" }]);
});

// The case that decides whether a user keeps the custom tags they created in
// the tag-management screen but never attached to a video.
test("the top-level tag list is carried through, including unattached tags", () => {
    const plan = parseExportPayload(
        makeBackup({
            tags: [
                { id: 1, name: "Powder", type: "custom" },
                { id: 2, name: "Kenta", type: "skier" },
            ],
            videos: [],
        })
    );
    assert.deepEqual(plan.tags, [
        { name: "Powder", type: "custom" },
        { name: "Kenta", type: "skier" },
    ]);
});

test("a malformed top-level tag is skipped and counted", () => {
    const plan = parseExportPayload(
        makeBackup({
            tags: [
                { id: 1, name: "keep", type: "custom" },
                { id: 2, name: "", type: "custom" },
                { id: 3, type: "custom" },
                { id: 4, name: "bad type", type: "nonsense" },
            ],
        })
    );
    assert.deepEqual(plan.tags, [{ name: "keep", type: "custom" }]);
    assert.equal(plan.skipped.tags, 3);
});

test("technique options keep name and sortOrder; malformed rows are skipped", () => {
    const plan = parseExportPayload(
        makeBackup({
            techniqueOptions: [
                { name: "小回り", sortOrder: 2 },
                { name: "コブ", sortOrder: 0 },
                { name: "no order" },
                { sortOrder: 3 },
            ],
        })
    );
    assert.deepEqual(plan.techniqueOptions, [
        { name: "小回り", sortOrder: 2 },
        { name: "コブ", sortOrder: 0 },
    ]);
    assert.equal(plan.skipped.techniqueOptions, 2);
});

test("favorite resorts accept a flat string array and drop the rest", () => {
    const plan = parseExportPayload(
        makeBackup({ favoriteResorts: ["志賀高原", 42, "", null, "白馬八方尾根"] })
    );
    assert.deepEqual(plan.favoriteResorts, ["志賀高原", "白馬八方尾根"]);
    assert.equal(plan.skipped.favoriteResorts, 3);
});

test("a diary entry without a dateKey is skipped; optionals default to null", () => {
    const plan = parseExportPayload(
        makeBackup({
            diaryEntries: [
                { dateKey: "2026-01-15", impressions: "良い日", createdAt: 10, updatedAt: 11 },
                { impressions: "no date" },
            ],
        })
    );
    assert.equal(plan.diaryEntries.length, 1);
    assert.equal(plan.skipped.diaryEntries, 1);
    const entry = plan.diaryEntries[0];
    assert.equal(entry.dateKey, "2026-01-15");
    assert.equal(entry.impressions, "良い日");
    assert.equal(entry.skiResortName, null);
    assert.equal(entry.weather, null);
    assert.equal(entry.snowCondition, null);
    assert.equal(entry.temperature, null);
    assert.equal(entry.companions, null);
    assert.equal(entry.fatigueLevel, null);
    assert.equal(entry.expenses, null);
    assert.equal(entry.numberOfRuns, null);
});

test("only the allowlisted preferences survive", () => {
    const plan = parseExportPayload(
        makeBackup({
            preferences: [
                { key: "home_sort_order", value: "newest" },
                { key: "weekStartDay", value: "monday" },
            ],
        })
    );
    assert.deepEqual(plan.preferences, [
        { key: "home_sort_order", value: "newest" },
        { key: "weekStartDay", value: "monday" },
    ]);
    assert.deepEqual([...RESTORABLE_PREFERENCE_KEYS].sort(), [
        "home_sort_order",
        "weekStartDay",
    ]);
});

// The rule #72 asks for. Restoring a migration bookmark onto a fresh install
// would make the app skip the migration that bookmark guards.
test("migration bookmarks and device state never restore", () => {
    const plan = parseExportPayload(
        makeBackup({
            preferences: [
                { key: "thumbnail_migration_version", value: "3" },
                { key: "capturedAt_repair_version", value: "2" },
                { key: "dismissed_update_prompt_version", value: "1.2.0" },
                { key: "weekStartDay", value: "sunday" },
            ],
        })
    );
    assert.deepEqual(plan.preferences, [{ key: "weekStartDay", value: "sunday" }]);
});

test("an unknown preference key is dropped without failing", () => {
    const plan = parseExportPayload(
        makeBackup({
            preferences: [
                { key: "some_future_setting", value: "x" },
                { key: "home_sort_order", value: "oldest" },
            ],
        })
    );
    assert.deepEqual(plan.preferences, [{ key: "home_sort_order", value: "oldest" }]);
});

test("duplicate video ids inside one payload collapse to the first", () => {
    const plan = parseExportPayload(
        makeBackup({
            videos: [
                makeExportedVideo({ id: "dup", assetId: "a-1", memo: "first" }),
                makeExportedVideo({ id: "dup", assetId: "a-2", memo: "second" }),
            ],
        })
    );
    assert.equal(plan.videos.length, 1);
    assert.equal(plan.videos[0].memo, "first");
});

test("appVersion and exportedAt survive, and missing ones do not throw", () => {
    const plan = parseExportPayload(makeBackup());
    assert.equal(plan.appVersion, "1.2.0");
    assert.equal(plan.exportedAt, "2026-01-15T00:00:00.000Z");

    const bare = parseExportPayload(
        makeBackup({ appVersion: undefined, exportedAt: undefined })
    );
    assert.equal(bare.appVersion, "unknown");
    assert.equal(bare.exportedAt, "");
});

test("a missing collection is treated as empty rather than fatal", () => {
    const partial = { schemaVersion: 1 };
    const plan = parseExportPayload(partial);
    assert.deepEqual(plan.videos, []);
    assert.deepEqual(plan.tags, []);
    assert.deepEqual(plan.diaryEntries, []);
    assert.deepEqual(plan.preferences, []);
});
