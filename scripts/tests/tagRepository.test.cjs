// Runs the real tagRepository against a real SQLite database built from
// drizzle/. See helpers/repositoryHarness.cjs for why this cannot use the plain
// tsc-compile pattern the other tests use.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const harness = createRepositoryHarness([
    "src/database/repositories/tagRepository.ts",
]);
const { getTagsForVideo, getTagsForVideos } = harness.load(
    "database/repositories/tagRepository.js"
);

test.after(() => harness.cleanup());

// Tag ids are seeded out of order on purpose: insertion order (10, 2, 7) differs
// from id order (2, 7, 10), so a query that forgets to sort still looks correct
// under a naive fixture.
harness.sqlite.exec(`
    INSERT INTO videos
        (id, asset_id, filename, thumbnail_uri, captured_at, created_at, updated_at)
    VALUES
        ('v1','a1','1.mov','thumbnails/1.jpg',1,1,1),
        ('v2','a2','2.mov','thumbnails/2.jpg',1,1,1),
        ('v3','a3','3.mov','thumbnails/3.jpg',1,1,1);

    INSERT INTO tags (id, name, type) VALUES
        (10,'zulu','custom'), (2,'alpha','skier'), (7,'mike','custom');

    INSERT INTO video_tags (video_id, tag_id) VALUES
        ('v1',10), ('v1',2), ('v1',7), ('v2',7);
`);

test("the migrations that built the fixture are the shipped ones", () => {
    assert.ok(harness.migrationCount > 0, "no migrations were applied");
});

// The two helpers are meant to be interchangeable. They were not: the batched
// one spread the joined row and leaked a videoId field into every Tag (6aecfbe).
test("getTagsForVideos returns exactly what getTagsForVideo returns", async () => {
    const batched = await getTagsForVideos(["v1", "v2", "v3"]);
    for (const id of ["v1", "v2", "v3"]) {
        assert.deepEqual(
            batched.get(id) ?? [],
            await getTagsForVideo(id),
            `batched and per-video results differ for ${id}`
        );
    }
});

// areVideoListsEqual compares tags positionally, so a different order makes every
// focus refresh look like a changed list and re-renders the whole feed.
test("getTagsForVideos sorts tags by id, not by insertion order", async () => {
    const map = await getTagsForVideos(["v1"]);
    assert.deepEqual(map.get("v1").map((t) => t.id), [2, 7, 10]);
});

test("getTagsForVideo sorts the same way", async () => {
    assert.deepEqual((await getTagsForVideo("v1")).map((t) => t.id), [2, 7, 10]);
});

// The whole point of the batched helper. Asserted as an exact count rather than
// "fewer than before" so that quietly reintroducing a per-row query fails here.
test("getTagsForVideos issues one query regardless of list length", async () => {
    harness.resetQueries();
    await getTagsForVideos(["v1", "v2", "v3"]);
    assert.equal(harness.queries.length, 1);
});

// Pins what the batched version replaced: two queries per video that has tags,
// one for a video that has none (it short-circuits before the second).
test("the per-video helper still costs a query per row", async () => {
    harness.resetQueries();
    for (const id of ["v1", "v2", "v3"]) await getTagsForVideo(id);
    assert.equal(harness.queries.length, 5);
});

test("videos with no tags are absent from the map rather than empty in it", async () => {
    const map = await getTagsForVideos(["v1", "v2", "v3"]);
    assert.equal(map.has("v3"), false);
    assert.deepEqual(map.get("v3") ?? [], []);
});

test("an empty list performs no query at all", async () => {
    harness.resetQueries();
    const map = await getTagsForVideos([]);
    assert.equal(map.size, 0);
    assert.equal(harness.queries.length, 0);
});

// A tag attached to two videos must appear under both, not only the first row
// the join happens to produce.
test("a shared tag is grouped under every video that has it", async () => {
    const map = await getTagsForVideos(["v1", "v2"]);
    assert.ok(map.get("v1").some((t) => t.id === 7));
    assert.ok(map.get("v2").some((t) => t.id === 7));
});

// Unknown ids must not throw or invent entries — useVideos passes whatever the
// filtered video query returned.
test("unknown video ids are simply absent", async () => {
    const map = await getTagsForVideos(["v1", "does-not-exist"]);
    assert.equal(map.has("does-not-exist"), false);
    assert.equal(map.get("v1").length, 3);
});

test("tags carry only id, name and type", async () => {
    const map = await getTagsForVideos(["v1"]);
    for (const tag of map.get("v1")) {
        assert.deepEqual(Object.keys(tag).sort(), ["id", "name", "type"]);
    }
});
