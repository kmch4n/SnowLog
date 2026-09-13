// The stored acquisition priority from #86 section 3.1, against real SQLite.
//
// The property that matters is what happens when nothing is stored: an absent
// or unreadable value must read as "not chosen", never as a default. Defaulting
// picks a network policy on the user's behalf before they have been asked.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const harness = createRepositoryHarness([
    "src/services/mediaPolicyService.ts",
]);

test.after(() => harness.cleanup());

const {
    MEDIA_PRIORITY_KEY,
    hasMediaPriority,
    readMediaPriority,
    setMediaPriority,
} = harness.load("services/mediaPolicyService.js");

const { sqlite } = harness;

function store(value) {
    sqlite.exec("DELETE FROM app_preferences");
    if (value !== undefined) {
        sqlite
            .prepare("INSERT INTO app_preferences (key, value) VALUES (?, ?)")
            .run(MEDIA_PRIORITY_KEY, value);
    }
}

test("the key is snake_case like every preference but the one legacy exception", () => {
    assert.equal(MEDIA_PRIORITY_KEY, "media_priority");
});

test("nothing stored reads as not chosen", async () => {
    store(undefined);
    assert.equal(await readMediaPriority(), null);
    assert.equal(await hasMediaPriority(), false);
});

test("both priorities round trip", async () => {
    for (const priority of ["save_space", "save_data"]) {
        store(undefined);
        await setMediaPriority(priority);
        assert.equal(await readMediaPriority(), priority);
        assert.equal(await hasMediaPriority(), true);
    }
});

test("an unreadable value reads as not chosen, not as a default", async () => {
    // Normalizing to either value would pick a network policy for the user.
    // One of the two allows cellular acquisition after a confirmation, so the
    // wrong guess spends their data.
    for (const bad of ["", "storage", "data", "SAVE_DATA", "reference", "copy", "1"]) {
        store(bad);
        assert.equal(await readMediaPriority(), null, bad);
        assert.equal(await hasMediaPriority(), false, bad);
    }
});

test("the stored value is the literal the type uses", async () => {
    store(undefined);
    await setMediaPriority("save_data");
    const row = sqlite
        .prepare("SELECT value FROM app_preferences WHERE key = ?")
        .get(MEDIA_PRIORITY_KEY);
    assert.equal(row.value, "save_data");
});

test("changing the priority replaces it rather than accumulating rows", async () => {
    store(undefined);
    await setMediaPriority("save_space");
    await setMediaPriority("save_data");
    const count = sqlite
        .prepare("SELECT COUNT(*) AS n FROM app_preferences WHERE key = ?")
        .get(MEDIA_PRIORITY_KEY).n;
    assert.equal(count, 1);
    assert.equal(await readMediaPriority(), "save_data");
});
