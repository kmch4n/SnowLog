// Exercises the pure backfill planner from #86 section 5.
//
// The planner holds every decision the migration makes, so it can be covered
// exhaustively here without a database. The transactional applier is checked
// separately in videoStorageMigration.test.cjs, which runs the real schema.
//
// `videoStorageBackfill.ts` has relative imports, so a plain `tsc <file>`
// compiles it but the emit nests under `out/services/`. See .memory/testing.md.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-backfill-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/services/videoStorageBackfill.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const { planStorageBackfill } = require(
    path.join(outDir, "services", "videoStorageBackfill.js")
);

function row(id, assetId, filename) {
    return { id, assetId, filename };
}

function byId(plan, id) {
    const found = plan.updates.find((u) => u.id === id);
    assert.ok(found, `no update planned for ${id}`);
    return found;
}

test("a Photos-backed row becomes a reference with no path", () => {
    const plan = planStorageBackfill([row("a", "PHAsset-1", "clip.mov")]);
    assert.deepEqual(byId(plan, "a"), {
        id: "a",
        storageMode: "reference",
        managedVideoPath: null,
        isFileAvailable: null,
    });
    assert.equal(plan.conflictCount, 0);
    assert.equal(plan.unsafeCount, 0);
});

test("a synthetic row becomes a copy owning its existing file", () => {
    const plan = planStorageBackfill([row("a", "synthetic:123", "clip.mp4")]);
    assert.deepEqual(byId(plan, "a"), {
        id: "a",
        storageMode: "copy",
        managedVideoPath: "videos/a.mp4",
        isFileAvailable: null,
    });
});

test("the copy path keeps the legacy extension convention", () => {
    const plan = planStorageBackfill([
        row("a", "synthetic:1", "clip.MOV"),
        row("b", "synthetic:2", "no-extension"),
        row("c", "synthetic:3", "old.avi"),
    ]);
    assert.equal(byId(plan, "a").managedVideoPath, "videos/a.mov");
    assert.equal(byId(plan, "b").managedVideoPath, "videos/b.mov");
    assert.equal(byId(plan, "c").managedVideoPath, "videos/c.avi");
});

test("synthetic detection stays case-sensitive, matching isSyntheticAssetId", () => {
    const plan = planStorageBackfill([row("a", "Synthetic:123", "clip.mov")]);
    assert.equal(byId(plan, "a").storageMode, "reference");
});

test("a missing file does not change the plan", () => {
    // The planner never touches the filesystem: a synthetic row whose file is
    // gone still owns its path, and the existing "source missing" path handles
    // it at read time. Deciding otherwise would need IO inside the migration.
    const plan = planStorageBackfill([row("gone", "synthetic:9", "clip.mov")]);
    assert.deepEqual(byId(plan, "gone"), {
        id: "gone",
        storageMode: "copy",
        managedVideoPath: "videos/gone.mov",
        isFileAvailable: null,
    });
});

test("an unsafe id yields a copy row with no path, marked unavailable", () => {
    const plan = planStorageBackfill([row("../escape", "synthetic:1", "clip.mov")]);
    assert.deepEqual(byId(plan, "../escape"), {
        id: "../escape",
        storageMode: "copy",
        managedVideoPath: null,
        isFileAvailable: 0,
    });
    assert.equal(plan.unsafeCount, 1);
});

test("an unsafe id on a Photos-backed row is still just a reference", () => {
    const plan = planStorageBackfill([row("a/b", "PHAsset-1", "clip.mov")]);
    assert.equal(byId(plan, "a/b").storageMode, "reference");
    assert.equal(plan.unsafeCount, 0);
});

test("a case-only path collision leaves exactly one owner", () => {
    const plan = planStorageBackfill([
        row("ABC", "synthetic:1", "clip.mov"),
        row("abc", "synthetic:2", "clip.mov"),
    ]);
    // Lexically smallest wins: "ABC" < "abc" in code-unit order.
    assert.equal(byId(plan, "ABC").managedVideoPath, "videos/ABC.mov");
    assert.deepEqual(byId(plan, "abc"), {
        id: "abc",
        storageMode: "copy",
        managedVideoPath: null,
        isFileAvailable: 0,
    });
    assert.equal(plan.conflictCount, 1);
});

test("the conflict winner does not depend on input order", () => {
    const forward = planStorageBackfill([
        row("ABC", "synthetic:1", "clip.mov"),
        row("abc", "synthetic:2", "clip.mov"),
    ]);
    const reversed = planStorageBackfill([
        row("abc", "synthetic:2", "clip.mov"),
        row("ABC", "synthetic:1", "clip.mov"),
    ]);
    assert.equal(byId(forward, "ABC").managedVideoPath, "videos/ABC.mov");
    assert.equal(byId(reversed, "ABC").managedVideoPath, "videos/ABC.mov");
    assert.equal(byId(reversed, "abc").managedVideoPath, null);
});

test("differing extensions are different files and do not collide", () => {
    const plan = planStorageBackfill([
        row("a", "synthetic:1", "clip.mov"),
        row("b", "synthetic:2", "clip.mp4"),
    ]);
    assert.equal(plan.conflictCount, 0);
    assert.equal(byId(plan, "a").managedVideoPath, "videos/a.mov");
    assert.equal(byId(plan, "b").managedVideoPath, "videos/b.mp4");
});

test("every row is planned exactly once", () => {
    const rows = [
        row("a", "PHAsset-1", "one.mov"),
        row("b", "synthetic:2", "two.mp4"),
        row("c", "synthetic:3", "three.mov"),
    ];
    const plan = planStorageBackfill(rows);
    assert.equal(plan.updates.length, rows.length);
    assert.deepEqual(
        plan.updates.map((u) => u.id).sort(),
        ["a", "b", "c"]
    );
});

test("an empty library plans nothing", () => {
    const plan = planStorageBackfill([]);
    assert.deepEqual(plan, { updates: [], conflictCount: 0, unsafeCount: 0 });
});
