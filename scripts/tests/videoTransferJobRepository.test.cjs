// Runs the transfer job repository against a real SQLite database.
//
// What matters here is not that the queries return rows, but that the two
// commit functions are all-or-nothing. Both finish a transfer whose file is
// already on disk, so a partial write cannot be fixed by retrying.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const harness = createRepositoryHarness([
    "src/database/repositories/videoTransferJobRepository.ts",
]);

test.after(() => harness.cleanup());

const {
    commitConvertedVideo,
    commitImportedVideoWithTags,
    deleteTransferJob,
    getAllTransferJobs,
    getTransferJobByAssetId,
    getTransferJobById,
    insertTransferJob,
    updateTransferJobPayload,
    updateTransferJobState,
} = harness.load("database/repositories/videoTransferJobRepository.js");

const { sqlite } = harness;

function makeJob(overrides = {}) {
    return {
        id: "job-1",
        assetId: "PHAsset-1",
        kind: "import",
        videoId: "v1",
        state: "pending",
        payloadJson: '{"version":1}',
        errorCode: null,
        createdAt: 100,
        updatedAt: 100,
        ...overrides,
    };
}

function makeVideoRow(overrides = {}) {
    return {
        id: "v1",
        assetId: "PHAsset-1",
        filename: "clip.mov",
        thumbnailUri: "thumbnails/v1.jpg",
        duration: 12,
        capturedAt: 1706774400,
        skiResortName: null,
        memo: "",
        title: null,
        techniques: null,
        isFileAvailable: 1,
        isFavorite: 0,
        storageMode: "copy",
        managedVideoPath: "videos/v1.mov",
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

function countRows(table) {
    return sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

function reset() {
    sqlite.exec("DELETE FROM video_tags");
    sqlite.exec("DELETE FROM video_transfer_jobs");
    sqlite.exec("DELETE FROM videos");
    sqlite.exec("DELETE FROM tags");
}

// --- basic persistence ---------------------------------------------------

test("a job round trips and is found by id and by asset", async () => {
    reset();
    await insertTransferJob(makeJob());

    const byId = await getTransferJobById("job-1");
    assert.equal(byId.assetId, "PHAsset-1");
    assert.equal(byId.state, "pending");

    const byAsset = await getTransferJobByAssetId("PHAsset-1");
    assert.equal(byAsset.id, "job-1");

    assert.equal(await getTransferJobById("nope"), null);
    assert.equal(await getTransferJobByAssetId("nope"), null);
});

test("one asset cannot hold two jobs", async () => {
    reset();
    await insertTransferJob(makeJob());
    await assert.rejects(() =>
        insertTransferJob(makeJob({ id: "job-2", videoId: "v2" }))
    );
    assert.equal(countRows("video_transfer_jobs"), 1);
});

test("state and payload updates land, and deletion removes the row", async () => {
    reset();
    await insertTransferJob(makeJob());

    await updateTransferJobState("job-1", "failed", "io_error", 200);
    let row = await getTransferJobById("job-1");
    assert.equal(row.state, "failed");
    assert.equal(row.errorCode, "io_error");
    assert.equal(row.updatedAt, 200);

    await updateTransferJobPayload("job-1", '{"version":1,"output":{}}', 300);
    row = await getTransferJobById("job-1");
    assert.equal(row.payloadJson, '{"version":1,"output":{}}');

    await deleteTransferJob("job-1");
    assert.equal(await getTransferJobById("job-1"), null);
});

test("jobs come back oldest first", async () => {
    reset();
    await insertTransferJob(makeJob({ id: "b", assetId: "A2", createdAt: 200 }));
    await insertTransferJob(makeJob({ id: "a", assetId: "A1", createdAt: 100 }));
    const all = await getAllTransferJobs();
    assert.deepEqual(all.map((job) => job.id), ["a", "b"]);
});

// --- committing an import ------------------------------------------------

test("committing an import writes the video, its tags, and drops the job", async () => {
    reset();
    sqlite.prepare("INSERT INTO tags (id, name, type) VALUES (1, 'Carving', 'technique')").run();
    sqlite.prepare("INSERT INTO tags (id, name, type) VALUES (2, 'Powder', 'custom')").run();
    await insertTransferJob(makeJob());

    const committed = await commitImportedVideoWithTags(makeVideoRow(), [1, 2], "job-1");

    assert.equal(committed, true);
    assert.equal(countRows("videos"), 1);
    assert.equal(countRows("video_tags"), 2);
    assert.equal(countRows("video_transfer_jobs"), 0);
});

test("a tag deleted since selection stops the commit entirely", async () => {
    reset();
    sqlite.prepare("INSERT INTO tags (id, name, type) VALUES (1, 'Carving', 'technique')").run();
    await insertTransferJob(makeJob());

    // Tag 2 never existed. Writing the video without it would silently discard
    // something the user typed, with the file already on disk and no retry.
    const committed = await commitImportedVideoWithTags(makeVideoRow(), [1, 2], "job-1");

    assert.equal(committed, false);
    assert.equal(countRows("videos"), 0);
    assert.equal(countRows("video_tags"), 0);
    assert.equal(countRows("video_transfer_jobs"), 1, "the job must survive for review");
});

test("a duplicate assetId rolls the whole commit back", async () => {
    reset();
    sqlite.prepare("INSERT INTO tags (id, name, type) VALUES (1, 'Carving', 'technique')").run();
    await insertTransferJob(makeJob({ assetId: "PHAsset-9" }));
    // Another row already owns this assetId; the unique constraint fires
    // after the job delete would have been queued.
    await commitImportedVideoWithTags(
        makeVideoRow({ id: "existing", assetId: "PHAsset-1", managedVideoPath: "videos/existing.mov" }),
        [],
        "missing-job"
    );

    await assert.rejects(() =>
        commitImportedVideoWithTags(makeVideoRow({ assetId: "PHAsset-1" }), [1], "job-1")
    );

    assert.equal(countRows("videos"), 1, "only the pre-existing video remains");
    assert.equal(countRows("video_tags"), 0);
    assert.equal(countRows("video_transfer_jobs"), 1, "the job is not lost");
});

// --- committing a conversion ---------------------------------------------

test("converting flips the existing row in place and drops the job", async () => {
    reset();
    await insertTransferJob(makeJob({ kind: "convert" }));
    sqlite
        .prepare(
            `INSERT INTO videos
                (id, asset_id, filename, thumbnail_uri, duration, captured_at,
                 memo, is_file_available, is_favorite, storage_mode,
                 managed_video_path, created_at, updated_at)
             VALUES ('v1','PHAsset-1','clip.mov','t.jpg',12,1706774400,'note',1,1,'reference',NULL,5,5)`
        )
        .run();

    const converted = await commitConvertedVideo("v1", "videos/v1.mov", 900, "job-1");

    assert.equal(converted, true);
    const row = sqlite.prepare("SELECT * FROM videos WHERE id = 'v1'").get();
    assert.equal(row.storage_mode, "copy");
    assert.equal(row.managed_video_path, "videos/v1.mov");
    assert.equal(row.updated_at, 900);
    // Identity and user data are untouched: conversion changes where the bytes
    // live, nothing else.
    assert.equal(row.asset_id, "PHAsset-1");
    assert.equal(row.memo, "note");
    assert.equal(row.is_favorite, 1);
    assert.equal(row.created_at, 5);
    assert.equal(countRows("video_transfer_jobs"), 0);
});

test("a row deleted during conversion is not resurrected", async () => {
    reset();
    await insertTransferJob(makeJob({ kind: "convert" }));

    const converted = await commitConvertedVideo("gone", "videos/gone.mov", 900, "job-1");

    assert.equal(converted, false);
    assert.equal(countRows("videos"), 0);
    assert.equal(countRows("video_transfer_jobs"), 0, "the intent is dropped with it");
});

test("a row already converted is left alone", async () => {
    reset();
    await insertTransferJob(makeJob({ kind: "convert" }));
    sqlite
        .prepare(
            `INSERT INTO videos
                (id, asset_id, filename, thumbnail_uri, duration, captured_at,
                 memo, is_file_available, is_favorite, storage_mode,
                 managed_video_path, created_at, updated_at)
             VALUES ('v1','PHAsset-1','clip.mov','t.jpg',12,1706774400,'',1,0,'copy','videos/other.mov',5,5)`
        )
        .run();

    const converted = await commitConvertedVideo("v1", "videos/v1.mov", 900, "job-1");

    assert.equal(converted, false);
    const row = sqlite.prepare("SELECT * FROM videos WHERE id = 'v1'").get();
    assert.equal(row.managed_video_path, "videos/other.mov", "the existing file keeps its owner");
    assert.equal(countRows("video_transfer_jobs"), 0);
});

test("two rows cannot end up owning one managed file", async () => {
    reset();
    await insertTransferJob(makeJob({ kind: "convert" }));
    sqlite
        .prepare(
            `INSERT INTO videos
                (id, asset_id, filename, thumbnail_uri, duration, captured_at,
                 memo, is_file_available, is_favorite, storage_mode,
                 managed_video_path, created_at, updated_at)
             VALUES ('squatter','PHAsset-9','a.mov','t.jpg',1,1,'',1,0,'copy','videos/v1.mov',1,1),
                    ('v1','PHAsset-1','clip.mov','t.jpg',12,1706774400,'',1,0,'reference',NULL,5,5)`
        )
        .run();

    await assert.rejects(() => commitConvertedVideo("v1", "videos/v1.mov", 900, "job-1"));

    const row = sqlite.prepare("SELECT * FROM videos WHERE id = 'v1'").get();
    assert.equal(row.storage_mode, "reference", "the source survives a failed conversion");
    assert.equal(countRows("video_transfer_jobs"), 1);
});
