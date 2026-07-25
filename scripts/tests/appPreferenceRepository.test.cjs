// Runs the real appPreferenceRepository against a real SQLite database built
// from drizzle/. See helpers/repositoryHarness.cjs for the recipe.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const harness = createRepositoryHarness([
    "src/database/repositories/appPreferenceRepository.ts",
]);
const {
    deletePreference,
    getAllPreferences,
    getPreference,
    setPreference,
} = harness.load("database/repositories/appPreferenceRepository.js");

test.after(() => harness.cleanup());

function keysInTable() {
    return harness.sqlite
        .prepare("SELECT key FROM app_preferences ORDER BY key")
        .all()
        .map((row) => row.key);
}

test.beforeEach(() => {
    harness.sqlite.exec("DELETE FROM app_preferences");
});

test("setPreference then getPreference round-trips", async () => {
    await setPreference("weekStartDay", "monday");
    assert.equal(await getPreference("weekStartDay"), "monday");
});

test("setPreference upserts rather than duplicating the key", async () => {
    await setPreference("home_sort_order", "newest");
    await setPreference("home_sort_order", "oldest");
    assert.equal(await getPreference("home_sort_order"), "oldest");
    assert.deepEqual(keysInTable(), ["home_sort_order"]);
});

test("getPreference returns null for a key that was never written", async () => {
    assert.equal(await getPreference("never-written"), null);
});

// The row left behind by the language picker removed in bab0b45. It is deleted
// at startup; this asserts the delete actually removes it.
test("deletePreference removes the stale app_locale row", async () => {
    harness.sqlite.exec(
        "INSERT INTO app_preferences (key, value) VALUES ('app_locale','ja')"
    );
    assert.deepEqual(keysInTable(), ["app_locale"], "precondition: the row exists");

    await deletePreference("app_locale");

    assert.deepEqual(keysInTable(), []);
});

// The control for the failure this issue nearly shipped with. The picker wrote
// `app_locale`; a cleanup aimed at `locale` runs, succeeds, and deletes nothing,
// so an acceptance check that only asserts "no locale row" passes vacuously.
test("deleting the wrong key leaves app_locale in place", async () => {
    harness.sqlite.exec(
        "INSERT INTO app_preferences (key, value) VALUES ('app_locale','ja')"
    );

    await deletePreference("locale");

    assert.deepEqual(keysInTable(), ["app_locale"]);
});

test("deletePreference leaves the keys still in use alone", async () => {
    harness.sqlite.exec(`
        INSERT INTO app_preferences (key, value) VALUES
            ('app_locale','ja'),
            ('weekStartDay','monday'),
            ('home_sort_order','newest'),
            ('thumbnail_migration_version','1'),
            ('capturedAt_repair_version','1'),
            ('dismissed_update_prompt_version','1.2.0');
    `);

    await deletePreference("app_locale");

    assert.deepEqual(keysInTable(), [
        "capturedAt_repair_version",
        "dismissed_update_prompt_version",
        "home_sort_order",
        "thumbnail_migration_version",
        "weekStartDay",
    ]);
});

test("deleting a key that is not there is a no-op, not an error", async () => {
    await setPreference("weekStartDay", "sunday");
    await deletePreference("app_locale");
    assert.deepEqual(keysInTable(), ["weekStartDay"]);
});

// exportService dumps whatever this returns straight into the backup JSON, so
// anything left in the table ends up in a user's backup.
test("getAllPreferences returns every stored row", async () => {
    await setPreference("weekStartDay", "monday");
    await setPreference("home_sort_order", "newest");

    const all = await getAllPreferences();

    assert.deepEqual(
        all.map((row) => [row.key, row.value]).sort(),
        [
            ["home_sort_order", "newest"],
            ["weekStartDay", "monday"],
        ]
    );
});
