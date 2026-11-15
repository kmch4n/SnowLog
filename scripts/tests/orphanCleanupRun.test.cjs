// The orphaned-file cleanup procedure (src/services/orphanCleanupRun.ts), run against
// an in-memory file system and video table so the interleaving with an import can
// be replayed exactly.
//
// The race it pins: the cleanup used to read the rows once, then walk the files.
// An import that finished in between (row inserted, protection released) left its
// file looking unreferenced and unprotected, and a copy whose modification time was
// old got deleted — the only copy of an app-managed video.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-orphan-cleanup-test-"));
test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));
execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/services/orphanCleanupRun.ts",
        "--outDir", outDir, "--target", "ES2020", "--module", "commonjs", "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);
const { runOrphanCleanup } = require(path.join(outDir, "orphanCleanupRun.js"));

const NOW = 10_000_000;
const OLD = NOW - 60 * 60 * 1000;
const AGE = 5 * 60 * 1000;

function world({ rows = [], thumbnails = {}, videos = {} } = {}) {
    const state = {
        rows: [...rows],
        files: { thumbnails: { ...thumbnails }, videos: { ...videos } },
        protected: new Set(),
        deleted: [],
        hooks: {},
    };
    const deps = {
        async listVideos() {
            state.hooks.beforeListVideos?.();
            const snapshot = state.rows.map((row) => ({ ...row }));
            state.hooks.afterListVideos?.();
            return snapshot;
        },
        async listFiles(directory) {
            const listed = Object.entries(state.files[directory]).map(([name, f]) => ({
                name,
                size: f.size ?? 1,
                modifiedAtMs: f.modifiedAtMs ?? OLD,
            }));
            state.hooks.afterListFiles?.(directory);
            return listed;
        },
        isProtected: (directory, name) => state.protected.has(`${directory}/${name}`),
        async deleteFile(directory, name) {
            delete state.files[directory][name];
            state.deleted.push(`${directory}/${name}`);
        },
        thumbnailFileName: (stored) =>
            stored.startsWith("thumbnails/") ? stored.slice("thumbnails/".length) : null,
        managedFileName: (relative) => relative.slice(relative.lastIndexOf("/") + 1),
        nowMs: () => NOW,
    };
    return { state, deps };
}

const row = (id, extra = {}) => ({
    id,
    thumbnailUri: `thumbnails/${id}.jpg`,
    storageMode: "reference",
    managedVideoPath: null,
    ...extra,
});

test("unreferenced old files are deleted; referenced and recent ones are kept", async () => {
    const { state, deps } = world({
        rows: [row("a", { storageMode: "copy", managedVideoPath: "videos/a.mov" })],
        thumbnails: { "a.jpg": {}, "orphan.jpg": { size: 10 }, "fresh.jpg": { modifiedAtMs: NOW - 1000 } },
        videos: { "a.mov": {}, "gone.mov": { size: 100 } },
    });
    const counts = await runOrphanCleanup(deps, AGE);
    assert.deepEqual(state.deleted.sort(), ["thumbnails/orphan.jpg", "videos/gone.mov"]);
    assert.deepEqual(counts, { deletedThumbnails: 1, deletedManagedVideos: 1, deletedBytes: 110 });
});

test("a protected file is never deleted", async () => {
    const { state, deps } = world({ videos: { "busy.mov": {} } });
    state.protected.add("videos/busy.mov");
    await runOrphanCleanup(deps, AGE);
    assert.deepEqual(state.deleted, []);
});

test("an import that finishes while the files are listed keeps its file", async () => {
    const { state, deps } = world({ videos: { "new.mov": {} }, thumbnails: { "new.jpg": {} } });
    // In flight when the cleanup starts: files written, row not yet inserted.
    state.protected.add("videos/new.mov");
    state.protected.add("thumbnails/new.jpg");
    state.hooks.afterListFiles = (directory) => {
        if (directory !== "videos") return;
        // The import completes: row inserted, then protection released.
        state.rows.push(row("new", { storageMode: "copy", managedVideoPath: "videos/new.mov" }));
        state.protected.clear();
    };
    await runOrphanCleanup(deps, AGE);
    assert.deepEqual(state.deleted, []);
});

test("an import that finishes during the re-read keeps its file", async () => {
    const { state, deps } = world({ videos: { "new.mov": {} } });
    state.protected.add("videos/new.mov");
    let reads = 0;
    state.hooks.beforeListVideos = () => {
        reads += 1;
        if (reads === 2) {
            state.rows.push(row("new", { storageMode: "copy", managedVideoPath: "videos/new.mov" }));
            state.protected.clear();
        }
    };
    await runOrphanCleanup(deps, AGE);
    assert.deepEqual(state.deleted, []);
});

// Why protection is checked before the re-read, not after: an import still in flight
// when the rows are re-read (row not yet inserted) and finishing just after would look
// unreferenced in the re-read and unprotected in a later check.
test("an import that finishes right after the re-read keeps its file", async () => {
    const { state, deps } = world({ videos: { "new.mov": {} } });
    state.protected.add("videos/new.mov");
    let reads = 0;
    state.hooks.afterListVideos = () => {
        reads += 1;
        if (reads === 2) {
            state.rows.push(row("new", { storageMode: "copy", managedVideoPath: "videos/new.mov" }));
            state.protected.clear();
        }
    };
    await runOrphanCleanup(deps, AGE);
    assert.deepEqual(state.deleted, []);
});

test("a copy row that lost its path keeps its file for manual recovery", async () => {
    const { state, deps } = world({
        rows: [row("ABC", { storageMode: "copy", managedVideoPath: null })],
        videos: { "abc.mov": {}, "other.mov": {} },
    });
    await runOrphanCleanup(deps, AGE);
    assert.deepEqual(state.deleted, ["videos/other.mov"]);
});

test("a reference row without a path protects nothing", async () => {
    const { state, deps } = world({
        rows: [row("abc", { storageMode: "reference", managedVideoPath: null })],
        videos: { "abc.mov": {} },
    });
    await runOrphanCleanup(deps, AGE);
    assert.deepEqual(state.deleted, ["videos/abc.mov"]);
});
