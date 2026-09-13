// Covers the harness's own migration-range option, which Issue #86 §5 needs so
// a backfill can be exercised against the schema as it was *before* the
// migration that introduces its columns.
//
// The assertions below are anchored on `diary_entries`, created by migration
// 0006 (journal index 5). Stopping at 6 must leave it absent; applying the rest
// must bring it in. If a future migration moves that table, this test fails
// loudly rather than silently proving nothing — which is the point.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const STOP_AFTER = 6;

function tableExists(sqlite, name) {
    const row = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(name);
    return row !== undefined;
}

const harness = createRepositoryHarness(
    ["src/database/repositories/appPreferenceRepository.ts"],
    { stopAfterMigrations: STOP_AFTER }
);

test.after(() => harness.cleanup());

test("stopping early applies exactly that many migrations", () => {
    assert.equal(harness.migrationCount, STOP_AFTER);
});

test("a table from a later migration is absent until the rest are applied", () => {
    assert.equal(
        tableExists(harness.sqlite, "diary_entries"),
        false,
        "diary_entries arrived before migration 0006 — re-anchor this test"
    );
    assert.equal(
        tableExists(harness.sqlite, "videos"),
        true,
        "videos should already exist at this point"
    );

    const total = harness.applyRemainingMigrations();

    assert.ok(total > STOP_AFTER, "no migrations remained to apply");
    assert.equal(harness.migrationCount, total);
    assert.equal(tableExists(harness.sqlite, "diary_entries"), true);
});

test("applying the remainder twice is a no-op", () => {
    const first = harness.applyRemainingMigrations();
    const second = harness.applyRemainingMigrations();
    assert.equal(first, second);
});
