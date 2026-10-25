// Row-first deletion order for videos and the files they own.
//
// The invariant is asymmetric: a failure may leave an unreferenced file
// (orphanedFileCleanupService reclaims it) but must never leave a row whose
// files are already gone (nothing reclaims that, and the user sees a video
// that cannot play). So no file deletion may START before the rows are gone.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-deletion-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/services/videoDeletionOrder.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const { runVideoDeletion } = require(path.join(outDir, "videoDeletionOrder.js"));

const VIDEOS = {
    a: { thumbnailUri: "thumbnails/a.jpg", managedVideoPath: "videos/a.mov" },
    b: { thumbnailUri: "thumbnails/b.jpg", managedVideoPath: null },
    sentinel: { thumbnailUri: "", managedVideoPath: "videos/sentinel.mov" },
};

/** Lets every pending microtask and timer callback run before continuing. */
function tick() {
    return new Promise((resolve) => setImmediate(resolve));
}

function makeDeps(overrides = {}) {
    const log = [];
    const deps = {
        log,
        getVideo: async (id) => {
            log.push(`get:${id}`);
            return VIDEOS[id] ?? null;
        },
        deleteRows: async (ids) => {
            // Yield first: an implementation that has already started a file
            // deletion gets to run it here, before the rows are gone.
            await tick();
            log.push(`rows:${ids.join(",")}`);
        },
        deleteThumbnail: async (stored) => {
            log.push(`thumb:${stored}`);
        },
        deleteManagedPath: async (relativePath) => {
            log.push(`file:${relativePath}`);
        },
        ...overrides,
    };
    return deps;
}

function fileEvents(log) {
    return log.filter((entry) => entry.startsWith("thumb:") || entry.startsWith("file:"));
}

test("does nothing for an empty id list", async () => {
    const deps = makeDeps();
    await runVideoDeletion([], deps);
    assert.deepEqual(deps.log, []);
});

test("deletes the rows before any owned file", async () => {
    const deps = makeDeps();
    await runVideoDeletion(["a", "b"], deps);

    const rowsAt = deps.log.indexOf("rows:a,b");
    assert.notEqual(rowsAt, -1, "rows were not deleted");
    for (const event of fileEvents(deps.log)) {
        assert.ok(
            deps.log.indexOf(event) > rowsAt,
            `${event} started before the rows were deleted: ${deps.log.join(" ")}`
        );
    }
    assert.deepEqual(fileEvents(deps.log).sort(), [
        "file:videos/a.mov",
        "thumb:thumbnails/a.jpg",
        "thumb:thumbnails/b.jpg",
    ]);
});

test("touches no file when the row deletion fails", async () => {
    const failure = new Error("database is locked");
    const deps = makeDeps({
        deleteRows: async () => {
            await tick();
            throw failure;
        },
    });

    await assert.rejects(runVideoDeletion(["a", "b"], deps), failure);
    await tick();
    assert.deepEqual(fileEvents(deps.log), []);
});

test("passes every requested id to the row deletion, including missing ones", async () => {
    const deps = makeDeps();
    await runVideoDeletion(["a", "missing"], deps);
    assert.ok(deps.log.includes("rows:a,missing"), deps.log.join(" "));
    assert.deepEqual(fileEvents(deps.log).sort(), [
        "file:videos/a.mov",
        "thumb:thumbnails/a.jpg",
    ]);
});

test("skips the missing-thumbnail sentinel and a copy without a path", async () => {
    const deps = makeDeps();
    await runVideoDeletion(["sentinel", "b"], deps);
    assert.deepEqual(fileEvents(deps.log).sort(), [
        "file:videos/sentinel.mov",
        "thumb:thumbnails/b.jpg",
    ]);
});

test("a failing file deletion neither propagates nor stops the others", async () => {
    const deps = makeDeps({
        deleteThumbnail: async (stored) => {
            deps.log.push(`thumb:${stored}`);
            throw new Error("permission denied");
        },
    });

    await runVideoDeletion(["a", "b"], deps);
    assert.deepEqual(fileEvents(deps.log).sort(), [
        "file:videos/a.mov",
        "thumb:thumbnails/a.jpg",
        "thumb:thumbnails/b.jpg",
    ]);
});

test("a deleter that throws synchronously is contained like a rejection", async () => {
    const deps = makeDeps({
        deleteManagedPath: () => {
            throw new Error("sync failure");
        },
    });
    await runVideoDeletion(["a", "b"], deps);
    assert.deepEqual(fileEvents(deps.log).sort(), [
        "thumb:thumbnails/a.jpg",
        "thumb:thumbnails/b.jpg",
    ]);
});

test("waits for the file deletions before resolving", async () => {
    let finished = 0;
    const deps = makeDeps({
        deleteThumbnail: async () => {
            await tick();
            finished += 1;
        },
    });
    await runVideoDeletion(["a", "b"], deps);
    assert.equal(finished, 2);
});
