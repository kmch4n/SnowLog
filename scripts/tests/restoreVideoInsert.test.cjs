// insertVideoWithTagsForRestore, on the driver the app ships.
//
// The point of the function (#88): a restored video and its tag links are
// written together or not at all. Before, the videos went in first and the
// tags in a later loop, so a restore that died in between left videos with no
// tags — and a re-run skips existing videos, so those tags never came back.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const harness = createRepositoryHarness(["src/database/repositories/videoRepository.ts"], {
    driver: "expo-sqlite",
});
const { insertVideoWithTagsForRestore } = harness.load(
    "database/repositories/videoRepository.js"
);

test.after(() => harness.cleanup());

function row(id, assetId) {
    return {
        id,
        assetId,
        filename: `${id}.mov`,
        thumbnailUri: "",
        duration: 10,
        capturedAt: 1,
        skiResortName: null,
        memo: "",
        title: null,
        techniques: null,
        isFileAvailable: 1,
        isFavorite: 0,
        storageMode: "reference",
        managedVideoPath: null,
        createdAt: 1,
        updatedAt: 1,
    };
}

function reset() {
    harness.sqlite.exec(`
        DROP TRIGGER IF EXISTS fail_link;
        DELETE FROM video_tags; DELETE FROM videos; DELETE FROM tags;
        INSERT INTO tags (id, name, type) VALUES (1,'a','custom'), (2,'b','skier');
        INSERT INTO videos
            (id, asset_id, filename, thumbnail_uri, captured_at, created_at, updated_at)
        VALUES ('existing','asset-existing','e.mov','',1,1,1);
        INSERT INTO video_tags (video_id, tag_id) VALUES ('existing', 2);
    `);
}

function videoIds() {
    return harness.sqlite.prepare("SELECT id FROM videos ORDER BY id").all().map((r) => r.id);
}

function linksOf(videoId) {
    return harness.sqlite
        .prepare("SELECT tag_id FROM video_tags WHERE video_id = ? ORDER BY tag_id")
        .all(videoId)
        .map((r) => r.tag_id);
}

test("a new video is written with its tags", () => {
    reset();
    assert.equal(insertVideoWithTagsForRestore(row("v1", "asset-1"), [1, 2]), true);
    assert.deepEqual(linksOf("v1"), [1, 2]);
});

test("a repeated tag id is linked once", () => {
    reset();
    assert.equal(insertVideoWithTagsForRestore(row("v1", "asset-1"), [1, 1]), true);
    assert.deepEqual(linksOf("v1"), [1]);
});

test("an existing id is skipped and its current tags are left alone", () => {
    reset();
    assert.equal(insertVideoWithTagsForRestore(row("existing", "asset-new"), [1]), false);
    assert.deepEqual(linksOf("existing"), [2]);
});

test("an asset already present under another id is skipped without touching links", () => {
    reset();
    assert.equal(insertVideoWithTagsForRestore(row("v2", "asset-existing"), [1]), false);
    assert.deepEqual(videoIds(), ["existing"]);
    assert.deepEqual(linksOf("v2"), []);
});

test("if the tag links cannot be written, the video is not written either", () => {
    reset();
    harness.sqlite.exec(`
        CREATE TRIGGER fail_link BEFORE INSERT ON video_tags
        BEGIN SELECT RAISE(ABORT, 'injected'); END;
    `);
    assert.throws(() => insertVideoWithTagsForRestore(row("v1", "asset-1"), [1]), /injected/);
    assert.deepEqual(videoIds(), ["existing"], "a video was left behind without its tags");
});
