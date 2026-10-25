// Covers the harness's `driver: "expo-sqlite"` mode, which runs the drizzle
// driver the app actually ships over a fake expo-sqlite client.
//
// The point of the mode is that `drizzle-orm/expo-sqlite` is synchronous:
// `transaction()` runs `begin`, calls the callback, and runs `commit` as soon as
// it returns. An async callback returns at its first `await`, so it is not a
// transaction at all. The default sqlite-proxy mode awaits the callback and
// hides that, so a test claiming atomicity under it proves nothing.
//
// The last case is a canary on the driver rather than on SnowLog code. If a
// drizzle upgrade starts awaiting async callbacks, it fails, and the guard in
// syncTransactions.test.cjs and `.memory/testing.md` should be revisited.

const assert = require("node:assert/strict");
const test = require("node:test");

const { eq } = require("drizzle-orm");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const harness = createRepositoryHarness(
    ["src/database/repositories/appPreferenceRepository.ts"],
    { driver: "expo-sqlite" }
);

test.after(() => harness.cleanup());

const { db, appPreferences } = harness.load("database/index.js");
const { getAllPreferences, getPreference, setPreference, deletePreference } =
    harness.load("database/repositories/appPreferenceRepository.js");

function reset() {
    harness.sqlite.exec("DELETE FROM app_preferences");
    harness.resetQueries();
}

function storedKeys() {
    return harness.sqlite
        .prepare("SELECT key FROM app_preferences ORDER BY key")
        .all()
        .map((row) => row.key);
}

test("the emitted db is the expo-sqlite driver", () => {
    assert.equal(db.constructor.name, "ExpoSQLiteDatabase");
});

test("repository reads and writes go through the fake client", async () => {
    reset();
    await setPreference("a", "1");
    await setPreference("a", "2");
    await setPreference("b", "3");

    assert.equal(await getPreference("a"), "2");
    assert.equal(await getPreference("missing"), null);
    assert.deepEqual(
        (await getAllPreferences()).map((row) => [row.key, row.value]),
        [
            ["a", "2"],
            ["b", "3"],
        ]
    );

    await deletePreference("a");
    assert.deepEqual(storedKeys(), ["b"]);
    assert.ok(harness.queries.length > 0, "queries were not recorded");
});

test("run() reports changes and the last rowid like expo-sqlite", () => {
    reset();
    const inserted = db.insert(appPreferences).values({ key: "k", value: "v" }).run();
    assert.equal(inserted.changes, 1);
    assert.equal(
        inserted.lastInsertRowId,
        harness.sqlite.prepare("SELECT rowid FROM app_preferences WHERE key = 'k'").get().rowid
    );

    const missed = db
        .update(appPreferences)
        .set({ value: "x" })
        .where(eq(appPreferences.key, "nope"))
        .run();
    assert.equal(missed.changes, 0);
});

test("a synchronous callback is a real transaction", () => {
    reset();
    assert.throws(() =>
        db.transaction((tx) => {
            tx.insert(appPreferences).values({ key: "first", value: "1" }).run();
            throw new Error("injected failure");
        })
    );
    assert.deepEqual(storedKeys(), [], "the first insert must roll back");

    const statements = harness.queries.map((query) => query.sql.toLowerCase());
    assert.equal(statements[0], "begin");
    assert.match(statements[1], /^insert into "app_preferences"/);
    assert.equal(statements[2], "rollback");
});

test("canary: an async callback commits before its statements run", async () => {
    reset();
    await assert.rejects(() =>
        db.transaction(async (tx) => {
            await tx.insert(appPreferences).values({ key: "first", value: "1" });
            throw new Error("injected failure");
        })
    );

    // Nothing rolled the insert back: it ran after COMMIT, in autocommit.
    assert.deepEqual(storedKeys(), ["first"]);
    const statements = harness.queries.map((query) => query.sql.toLowerCase());
    assert.deepEqual(statements.slice(0, 2), ["begin", "commit"]);
});
