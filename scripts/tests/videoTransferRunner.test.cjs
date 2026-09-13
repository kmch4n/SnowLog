// The acquisition-to-commit order from #86 section 6, with failures injected
// at every boundary.
//
// The invariant under test is asymmetric on purpose: a failure may leave an
// unreferenced file (cleanup reclaims it) but must never leave a committed row
// whose media is missing (nothing reclaims that).

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-runner-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/services/videoTransferRunner.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const {
    FREE_SPACE_RESERVE_BYTES,
    outcomeToJobEvent,
    runVideoTransfer,
} = require(path.join(outDir, "services", "videoTransferRunner.js"));

const READY = {
    kind: "ready",
    requestId: "req-1",
    localUri: "file:///staging/req-1/clip.mov",
    extension: "mov",
    bytes: 2048,
    duration: 12,
    width: 1920,
    height: 1080,
};

function makeContext(overrides = {}) {
    return {
        payload: {
            version: 1,
            asset: { assetId: "PHAsset-1", filename: "clip.mov", capturedAt: 1, duration: 12, width: 1920, height: 1080, modificationTime: null, location: null },
            metadata: null,
            storageIntent: "copy",
            managedVideoPath: "videos/v1.mov",
            output: null,
        },
        requestId: "req-1",
        networkAccess: "deny",
        isCancelled: () => false,
        ...overrides,
    };
}

function makeDeps(overrides = {}) {
    const log = [];
    const deps = {
        log,
        prepare: async (assetId, requestId, networkAccess) => {
            log.push(`prepare:${networkAccess}`);
            return READY;
        },
        release: async () => {
            log.push("release");
        },
        getFreeDiskBytes: async () => {
            log.push("space");
            return FREE_SPACE_RESERVE_BYTES * 10;
        },
        promote: async () => {
            log.push("promote");
        },
        discard: async () => {
            log.push("discard");
        },
        saveOutput: async () => {
            log.push("saveOutput");
        },
        commit: async () => {
            log.push("commit");
            return true;
        },
        ...overrides,
    };
    return deps;
}

// --- the happy path ------------------------------------------------------

test("a successful transfer runs the stages in the required order", async () => {
    const deps = makeDeps();
    const outcome = await runVideoTransfer(makeContext(), deps);

    assert.equal(outcome.kind, "committed");
    assert.deepEqual(deps.log, [
        "prepare:deny",
        "space",
        // The descriptor is written before the rename: a crash right after the
        // rename otherwise leaves a finished file the job cannot recognise.
        "saveOutput",
        "promote",
        "commit",
        "release",
    ]);
    assert.deepEqual(outcome.output, {
        bytes: 2048,
        extension: "mov",
        duration: 12,
        width: 1920,
        height: 1080,
    });
});

test("the network flag is passed through, never defaulted", async () => {
    const deps = makeDeps();
    await runVideoTransfer(makeContext({ networkAccess: "allow" }), deps);
    assert.equal(deps.log[0], "prepare:allow");
});

// --- blocked before anything is held ------------------------------------

test("a blocked preparation commits nothing and holds no file", async () => {
    const deps = makeDeps({
        prepare: async () => ({ kind: "blocked", code: "needs_network" }),
    });
    const outcome = await runVideoTransfer(makeContext(), deps);

    assert.deepEqual(outcome, { kind: "blocked", code: "needs_network" });
    assert.equal(deps.log.includes("commit"), false);
    assert.equal(deps.log.includes("release"), false, "nothing was acquired to release");
});

test("a throwing adapter becomes an io_error, not an exception", async () => {
    const deps = makeDeps({
        prepare: async () => {
            throw new Error("native blew up");
        },
    });
    assert.deepEqual(await runVideoTransfer(makeContext(), deps), {
        kind: "blocked",
        code: "io_error",
    });
});

test("cancelling before preparation does not touch the adapter", async () => {
    const deps = makeDeps();
    const outcome = await runVideoTransfer(
        makeContext({ isCancelled: () => true }),
        deps
    );
    assert.deepEqual(outcome, { kind: "blocked", code: "cancelled" });
    assert.deepEqual(deps.log, []);
});

// --- failures after a file is held --------------------------------------

test("a file acquired then cancelled is released and never committed", async () => {
    let calls = 0;
    const deps = makeDeps();
    const outcome = await runVideoTransfer(
        makeContext({
            isCancelled: () => {
                calls += 1;
                // False at the entry gate, true once the file is in hand.
                return calls > 1;
            },
        }),
        deps
    );

    assert.deepEqual(outcome, { kind: "blocked", code: "cancelled" });
    assert.equal(deps.log.includes("commit"), false);
    assert.equal(deps.log.includes("promote"), false);
    assert.equal(deps.log.at(-1), "release");
});

test("too little free space stops before the file is promoted", async () => {
    const deps = makeDeps({
        getFreeDiskBytes: async () => FREE_SPACE_RESERVE_BYTES - 1,
    });
    const outcome = await runVideoTransfer(makeContext(), deps);

    assert.deepEqual(outcome, { kind: "blocked", code: "insufficient_space" });
    assert.equal(deps.log.includes("promote"), false);
    assert.equal(deps.log.at(-1), "release");
});

test("unknown free space is not treated as a failure", async () => {
    // Refusing to work when the figure cannot be read would disable the
    // feature on any device that does not report it.
    const deps = makeDeps({ getFreeDiskBytes: async () => null });
    assert.equal((await runVideoTransfer(makeContext(), deps)).kind, "committed");
});

test("a failed promotion commits nothing", async () => {
    const deps = makeDeps({
        promote: async () => {
            throw new Error("rename failed");
        },
    });
    const outcome = await runVideoTransfer(makeContext(), deps);

    assert.deepEqual(outcome, { kind: "blocked", code: "io_error" });
    assert.equal(deps.log.includes("commit"), false);
});

test("a failed commit removes the file this job promoted", async () => {
    // The row does not exist, so the file belongs to nobody. Leaving it for the
    // generic cleanup means it survives the grace period as an orphan.
    const deps = makeDeps({
        commit: async () => {
            throw new Error("db down");
        },
    });
    const outcome = await runVideoTransfer(makeContext(), deps);

    assert.deepEqual(outcome, { kind: "blocked", code: "io_error" });
    assert.equal(deps.log.includes("discard"), true);
    assert.equal(deps.log.at(-1), "release");
});

test("a refused commit is a skip, and still cleans up its file", async () => {
    const deps = makeDeps({ commit: async () => false });
    const outcome = await runVideoTransfer(makeContext(), deps);

    assert.deepEqual(outcome, { kind: "skipped" });
    assert.equal(deps.log.includes("discard"), true);
});

test("a failure saving the descriptor stops before the rename", async () => {
    const deps = makeDeps({
        saveOutput: async () => {
            throw new Error("db down");
        },
    });
    const outcome = await runVideoTransfer(makeContext(), deps);

    assert.deepEqual(outcome, { kind: "blocked", code: "io_error" });
    assert.equal(deps.log.includes("promote"), false);
});

test("the acquired file is released on every path that acquired one", async () => {
    const failures = [
        { saveOutput: async () => { throw new Error("x"); } },
        { promote: async () => { throw new Error("x"); } },
        { commit: async () => { throw new Error("x"); } },
        { commit: async () => false },
        { getFreeDiskBytes: async () => 0 },
    ];
    for (const override of failures) {
        const deps = makeDeps(override);
        await runVideoTransfer(makeContext(), deps);
        assert.equal(
            deps.log.at(-1),
            "release",
            `release missing for ${Object.keys(override)[0]}`
        );
    }
});

test("a release that throws does not mask the outcome", async () => {
    const deps = makeDeps({
        release: async () => {
            throw new Error("release failed");
        },
    });
    assert.equal((await runVideoTransfer(makeContext(), deps)).kind, "committed");
});

// --- translating the outcome into a job event ---------------------------

test("needing the network waits rather than fails", async () => {
    // A device with no Wi-Fi right now is a state, not a defect in the job.
    assert.deepEqual(
        outcomeToJobEvent({ kind: "blocked", code: "needs_network" }),
        { type: "needsWifi" }
    );
});

test("the other outcomes map to complete, cancel or fail", () => {
    assert.deepEqual(
        outcomeToJobEvent({ kind: "committed", output: {} }),
        { type: "complete" }
    );
    // A skip means the library already holds it: the intent is satisfied, so
    // leaving a retry button would offer the user an action that cannot help.
    assert.deepEqual(outcomeToJobEvent({ kind: "skipped" }), { type: "complete" });
    assert.deepEqual(
        outcomeToJobEvent({ kind: "blocked", code: "cancelled" }),
        { type: "cancel" }
    );
    for (const code of ["io_error", "insufficient_space", "timeout", "missing"]) {
        assert.deepEqual(
            outcomeToJobEvent({ kind: "blocked", code }),
            { type: "fail", code }
        );
    }
});
