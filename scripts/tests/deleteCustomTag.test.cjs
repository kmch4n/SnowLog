// deleteCustomTag against the driver the app ships (see helpers/repositoryHarness.cjs).
//
// Two properties: a tag that is not custom is left completely alone, links
// included; and the links and the tag go together or not at all.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const harness = createRepositoryHarness(["src/database/repositories/tagRepository.ts"], {
    driver: "expo-sqlite",
});
const { deleteCustomTag } = harness.load("database/repositories/tagRepository.js");

test.after(() => harness.cleanup());

function reset() {
    harness.sqlite.exec(`
        DROP TRIGGER IF EXISTS fail_tag_delete;
        DELETE FROM video_tags; DELETE FROM tags; DELETE FROM videos;
        INSERT INTO videos
            (id, asset_id, filename, thumbnail_uri, captured_at, created_at, updated_at)
        VALUES ('v1','a1','1.mov','',1,1,1);
        INSERT INTO tags (id, name, type) VALUES (1,'mine','custom'), (2,'Kenta','skier');
        INSERT INTO video_tags (video_id, tag_id) VALUES ('v1',1), ('v1',2);
    `);
}

function links() {
    return harness.sqlite
        .prepare("SELECT tag_id FROM video_tags ORDER BY tag_id")
        .all()
        .map((row) => row.tag_id);
}

function tagIds() {
    return harness.sqlite
        .prepare("SELECT id FROM tags ORDER BY id")
        .all()
        .map((row) => row.id);
}

test("a custom tag and its links are deleted", async () => {
    reset();
    await deleteCustomTag(1);
    assert.deepEqual(tagIds(), [2]);
    assert.deepEqual(links(), [2]);
});

test("a tag that is not custom keeps its links as well as itself", async () => {
    reset();
    await deleteCustomTag(2);
    assert.deepEqual(tagIds(), [1, 2]);
    assert.deepEqual(links(), [1, 2], "a skier tag's links were removed while the tag survived");
});

test("if deleting the tag fails, its links come back too", async () => {
    reset();
    harness.sqlite.exec(`
        CREATE TRIGGER fail_tag_delete BEFORE DELETE ON tags
        BEGIN SELECT RAISE(ABORT, 'injected'); END;
    `);
    await assert.rejects(() => deleteCustomTag(1));
    assert.deepEqual(tagIds(), [1, 2]);
    assert.deepEqual(links(), [1, 2], "links were deleted outside the transaction");
});
