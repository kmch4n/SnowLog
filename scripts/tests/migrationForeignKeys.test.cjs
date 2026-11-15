// A drizzle-kit table rebuild would silently wipe video_tags.
//
// src/database/index.ts turns `PRAGMA foreign_keys = ON` when the database opens, and
// drizzle's migrate() runs every pending migration inside one BEGIN…COMMIT
// (node_modules/drizzle-orm/sqlite-core/dialect.js, SQLiteSyncDialect.migrate). When a
// schema change cannot be done with ALTER TABLE, drizzle-kit generates a rebuild:
//
//     PRAGMA foreign_keys=OFF;  CREATE TABLE __new_videos …;  INSERT …;
//     DROP TABLE videos;  ALTER TABLE __new_videos RENAME TO videos;  PRAGMA foreign_keys=ON;
//
// SQLite ignores `PRAGMA foreign_keys` inside a transaction, so the DROP TABLE runs with
// foreign keys still on and fires ON DELETE CASCADE: every row of video_tags is gone.
// None of 0000–0009 does this. The test below fails the suite the moment one does, so
// the author has to handle it first (see .memory/wiring.md, "マイグレーションの落とし穴").

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const drizzleDir = path.resolve(__dirname, "..", "..", "drizzle");

test("control: inside a transaction, foreign_keys=OFF does not stop the cascade", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE videos (id TEXT PRIMARY KEY);
        CREATE TABLE video_tags (
            video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE
        );
        INSERT INTO videos VALUES ('v1');
        INSERT INTO video_tags VALUES ('v1');
        BEGIN;
        PRAGMA foreign_keys=OFF;
        CREATE TABLE __new_videos (id TEXT PRIMARY KEY);
        INSERT INTO __new_videos SELECT id FROM videos;
        DROP TABLE videos;
        ALTER TABLE __new_videos RENAME TO videos;
        PRAGMA foreign_keys=ON;
        COMMIT;
    `);
    const { n } = db.prepare("SELECT count(*) AS n FROM video_tags").get();
    db.close();
    assert.equal(n, 0, "the trap no longer reproduces; revisit this guard and the .memory note");
});

test("no generated migration rebuilds a table", () => {
    const files = fs.readdirSync(drizzleDir).filter((name) => name.endsWith(".sql"));
    assert.ok(files.length >= 10, "migrations not found");
    const offenders = files.filter((name) => {
        const sql = fs.readFileSync(path.join(drizzleDir, name), "utf8");
        return /PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(sql) || /\bDROP\s+TABLE\b/i.test(sql);
    });
    assert.deepEqual(
        offenders,
        [],
        "A migration drops or rebuilds a table. Under drizzle's single transaction with " +
            "foreign_keys ON this cascades and empties video_tags. Handle it before shipping " +
            "(.memory/wiring.md, マイグレーションの落とし穴)."
    );
});
