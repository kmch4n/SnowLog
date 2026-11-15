// Search runs the real getVideosByFilter against SQLite built from drizzle/, on the
// driver the app ships. See helpers/repositoryHarness.cjs.
//
// The bug this pins: escapeLike turned "_" into "\_", but the query had no ESCAPE
// clause, so SQLite matched a literal backslash and "IMG_0123" (the shape of every
// iPhone filename) found nothing. The Web mock uses String.includes, so the Web
// smoke could not see it.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const harness = createRepositoryHarness(
    ["src/database/repositories/videoRepository.ts"],
    { driver: "expo-sqlite" }
);
const { getVideosByFilter } = harness.load("database/repositories/videoRepository.js");

test.after(() => harness.cleanup());

harness.sqlite.exec(`
    INSERT INTO videos
        (id, asset_id, filename, title, memo, thumbnail_uri, captured_at, created_at, updated_at)
    VALUES
        ('v1','a1','IMG_0123.MOV', NULL, '', 'thumbnails/1.jpg', 3, 1, 1),
        ('v2','a2','IMGX0123.MOV', NULL, '', 'thumbnails/2.jpg', 2, 1, 1),
        ('v3','a3','run.mov', '100% powder', '', 'thumbnails/3.jpg', 1, 1, 1),
        ('v4','a4','b.mov', NULL, 'path C:\\temp\\x', 'thumbnails/4.jpg', 0, 1, 1);
`);

async function idsFor(searchText) {
    return (await getVideosByFilter({ searchText })).map((v) => v.id);
}

test("an underscore matches only an underscore", async () => {
    assert.deepEqual(await idsFor("IMG_0123"), ["v1"]);
    // Unescaped, "_" would also match the X in IMGX0123.
    assert.deepEqual(await idsFor("G_0"), ["v1"]);
});

test("a percent sign matches only a percent sign", async () => {
    assert.deepEqual(await idsFor("100%"), ["v3"]);
    assert.deepEqual(await idsFor("0% p"), ["v3"]);
});

test("a backslash in the search text is matched literally", async () => {
    assert.deepEqual(await idsFor("C:\\temp"), ["v4"]);
});

test("plain text still matches filename, title and memo, case-insensitively", async () => {
    assert.deepEqual(await idsFor("img"), ["v1", "v2"]);
    assert.deepEqual(await idsFor("POWDER"), ["v3"]);
    assert.deepEqual(await idsFor("temp"), ["v4"]);
});
