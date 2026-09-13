// Runs the real storage backfill against the real schema, seeded as it stood
// *before* the migration that adds its columns (#86 section 5). Creating the
// rows after every migration has run would test something else: the backfill
// would see columns that did not exist when the rows were written.
//
// The planner's decisions are covered exhaustively in
// videoStorageBackfill.test.cjs. What this file adds is the transaction: that
// the marker and the rows commit together, and that a failure writes nothing.
//
// `begin`/`commit` do reach node:sqlite through the proxy (verified by the
// rollback case below), so atomicity here is real and not a query-shape claim.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

// 0008 is the migration that adds storage_mode / managed_video_path, so stop
// one short of it to get the pre-change schema.
const MIGRATIONS_BEFORE_STORAGE_COLUMNS = 8;

const harness = createRepositoryHarness(
    [
        "src/services/storageMigrationService.ts",
        "src/database/repositories/videoStorageRepository.ts",
        "src/database/repositories/appPreferenceRepository.ts",
    ],
    { stopAfterMigrations: MIGRATIONS_BEFORE_STORAGE_COLUMNS }
);

test.after(() => harness.cleanup());

const { sqlite } = harness;

function columnNames(table) {
    return sqlite
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((column) => column.name);
}

function seedRow(id, assetId, filename) {
    sqlite
        .prepare(
            `INSERT INTO videos
                (id, asset_id, filename, thumbnail_uri, duration, captured_at,
                 memo, is_file_available, is_favorite, created_at, updated_at)
             VALUES (?, ?, ?, '', 10, 1706774400, '', 1, 0, 1, 1)`
        )
        .run(id, assetId, filename);
}

function readRow(id) {
    const row = sqlite
        .prepare(
            "SELECT id, storage_mode, managed_video_path, is_file_available FROM videos WHERE id = ?"
        )
        .get(id);
    // node:sqlite hands back a null-prototype object, which strict deepEqual
    // refuses to match against an object literal. Copy it into a plain one.
    return row === undefined ? undefined : { ...row };
}

function readMarker() {
    const row = sqlite
        .prepare("SELECT value FROM app_preferences WHERE key = ?")
        .get("video_storage_migration_version");
    return row ? row.value : null;
}

// --- seed against the pre-change schema ----------------------------------

test("the seeded schema really predates the storage columns", () => {
    const columns = columnNames("videos");
    assert.equal(columns.includes("storage_mode"), false);
    assert.equal(columns.includes("managed_video_path"), false);

    seedRow("photo-row", "PHAsset-AAA", "hakuba.mov");
    seedRow("copy-row", "synthetic:111", "recorded.mp4");
    seedRow("copy-no-ext", "synthetic:222", "nameless");
    seedRow("missing-file", "synthetic:333", "gone.mov");

    assert.equal(harness.migrationCount, MIGRATIONS_BEFORE_STORAGE_COLUMNS);
});

test("applying the remaining migrations adds the columns with defaults", () => {
    harness.applyRemainingMigrations();

    const columns = columnNames("videos");
    assert.equal(columns.includes("storage_mode"), true);
    assert.equal(columns.includes("managed_video_path"), true);

    // Rows written before the migration take the column default, which is why
    // the backfill cannot be left to the SQL default alone: every one of these
    // is currently "reference", including the synthetic ones.
    assert.equal(readRow("copy-row").storage_mode, "reference");
    assert.equal(readRow("copy-row").managed_video_path, null);
});

// --- the backfill --------------------------------------------------------

test("the backfill assigns modes and paths, and records the marker", async (t) => {
    const { migrateVideoStorage, isVideoStorageMigrationNeeded } = harness.load(
        "services/storageMigrationService.js"
    );

    assert.equal(await isVideoStorageMigrationNeeded(), true);
    assert.equal(readMarker(), null);

    const result = await migrateVideoStorage();

    assert.equal(result.updated, 4);
    assert.equal(result.conflictCount, 0);
    assert.equal(result.unsafeCount, 0);

    await t.test("a Photos-backed row stays a reference", () => {
        assert.deepEqual(readRow("photo-row"), {
            id: "photo-row",
            storage_mode: "reference",
            managed_video_path: null,
            is_file_available: 1,
        });
    });

    await t.test("a synthetic row becomes a copy owning its file", () => {
        assert.deepEqual(readRow("copy-row"), {
            id: "copy-row",
            storage_mode: "copy",
            managed_video_path: "videos/copy-row.mp4",
            is_file_available: 1,
        });
    });

    await t.test("an extensionless name falls back to mov", () => {
        assert.equal(readRow("copy-no-ext").managed_video_path, "videos/copy-no-ext.mov");
    });

    await t.test("a row whose file is gone keeps its path and availability", () => {
        // The migration performs no IO, so it cannot know the file vanished.
        // The existing missing-source path reports that at read time.
        assert.deepEqual(readRow("missing-file"), {
            id: "missing-file",
            storage_mode: "copy",
            managed_video_path: "videos/missing-file.mov",
            is_file_available: 1,
        });
    });

    await t.test("the marker commits with the rows", async () => {
        assert.equal(readMarker(), "1");
        assert.equal(await isVideoStorageMigrationNeeded(), false);
    });
});

test("running it a second time changes nothing", async () => {
    const { migrateVideoStorage } = harness.load(
        "services/storageMigrationService.js"
    );

    // Someone switched this row by hand after the migration. A re-run must not
    // walk it back — that is what the marker is for.
    sqlite
        .prepare("UPDATE videos SET storage_mode = 'copy', managed_video_path = ? WHERE id = ?")
        .run("videos/photo-row.mov", "photo-row");

    const result = await migrateVideoStorage();

    assert.equal(result.updated, 0);
    assert.equal(readRow("photo-row").storage_mode, "copy");
    assert.equal(readRow("photo-row").managed_video_path, "videos/photo-row.mov");
});

// --- atomicity -----------------------------------------------------------

test("a failing update writes nothing and leaves the marker unset", async () => {
    const failing = createRepositoryHarness(
        [
            "src/services/storageMigrationService.ts",
            "src/database/repositories/videoStorageRepository.ts",
            "src/database/repositories/appPreferenceRepository.ts",
        ],
        { stopAfterMigrations: MIGRATIONS_BEFORE_STORAGE_COLUMNS }
    );
    try {
        const db = failing.sqlite;
        const insert = (id, assetId, filename) =>
            db
                .prepare(
                    `INSERT INTO videos
                        (id, asset_id, filename, thumbnail_uri, duration, captured_at,
                         memo, is_file_available, is_favorite, created_at, updated_at)
                     VALUES (?, ?, ?, '', 10, 1706774400, '', 1, 0, 1, 1)`
                )
                .run(id, assetId, filename);

        // Row order is plan order, so "doomed" fails after "early" succeeded.
        insert("early", "synthetic:444", "clip.mov");
        insert("doomed", "synthetic:555", "clip.mov");
        failing.applyRemainingMigrations();

        // Fault injection at a chosen statement. A unique-index collision will
        // not do: the planner resolves those before any SQL is issued, so it
        // would prove the planner works rather than that the transaction rolls
        // back.
        db.exec(`
            CREATE TRIGGER fail_one_update BEFORE UPDATE ON videos
            WHEN NEW.id = 'doomed'
            BEGIN SELECT RAISE(ABORT, 'injected failure'); END;
        `);

        const { migrateVideoStorage } = failing.load(
            "services/storageMigrationService.js"
        );

        await assert.rejects(() => migrateVideoStorage());

        const read = (id) =>
            db
                .prepare("SELECT storage_mode, managed_video_path FROM videos WHERE id = ?")
                .get(id);

        // The update that had already succeeded is gone with the rest.
        assert.equal(read("early").storage_mode, "reference");
        assert.equal(read("early").managed_video_path, null);
        assert.equal(read("doomed").storage_mode, "reference");
        assert.equal(
            db
                .prepare("SELECT value FROM app_preferences WHERE key = ?")
                .get("video_storage_migration_version"),
            undefined
        );
    } finally {
        failing.cleanup();
    }
});
