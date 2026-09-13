// Crash reconciliation from #86 section 6.
//
// Every case here describes a process that died at a different point, so the
// combinations matter more than any single one: the plan has to be total, and
// it has to never fabricate a row from a file it cannot vouch for.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-recovery-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/services/videoTransferRecovery.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const { planTransferRecoveries, planTransferRecovery } = require(
    path.join(outDir, "services", "videoTransferRecovery.js")
);

const STATES = ["pending", "running", "waiting_wifi", "paused", "failed"];

function observe(overrides = {}) {
    return {
        jobId: "job-1",
        state: "running",
        payloadValid: true,
        hasVerifiedOutput: false,
        finalFileExists: false,
        finalFileMatchesOutput: false,
        videoRowExists: false,
        ...overrides,
    };
}

test("a job whose video already exists is just a leftover", () => {
    const plan = planTransferRecovery(
        observe({ videoRowExists: true, finalFileExists: true, hasVerifiedOutput: true })
    );
    assert.deepEqual(plan.action, { kind: "dropJob", reason: "alreadyCommitted" });
    // The committed row is using that file. Deleting it here would take the
    // media away from a video the user can already see.
    assert.equal(plan.discardFinalFile, false);
});

test("an already-committed video wins regardless of the job state", () => {
    for (const state of STATES) {
        const plan = planTransferRecovery(observe({ state, videoRowExists: true }));
        assert.equal(plan.action.kind, "dropJob", state);
    }
});

test("a verified file that matches its descriptor is finalized, not re-fetched", () => {
    // Acquisition finished and only the database write was lost. Downloading
    // the movie again would spend the user's data to reach the same place.
    const plan = planTransferRecovery(
        observe({
            hasVerifiedOutput: true,
            finalFileExists: true,
            finalFileMatchesOutput: true,
        })
    );
    assert.deepEqual(plan.action, { kind: "finalize" });
    assert.equal(plan.discardFinalFile, false);
});

test("a verified file that no longer matches is refused, and the intent kept", () => {
    const plan = planTransferRecovery(
        observe({
            hasVerifiedOutput: true,
            finalFileExists: true,
            finalFileMatchesOutput: false,
        })
    );
    assert.deepEqual(plan.action, { kind: "fail", code: "source_changed" });
    assert.equal(plan.discardFinalFile, true, "content we cannot vouch for must not survive");
});

test("a partial file is discarded rather than resumed", () => {
    // The writer died with the handle open; there is no byte-range resume
    // here, so the next attempt starts from zero.
    const plan = planTransferRecovery(
        observe({ hasVerifiedOutput: false, finalFileExists: true })
    );
    assert.equal(plan.discardFinalFile, true);
    assert.deepEqual(plan.action, { kind: "pause" });
});

test("a job caught running is paused, never restarted", () => {
    // #86 section 12 forbids a relaunch from becoming a network request.
    const plan = planTransferRecovery(observe({ state: "running" }));
    assert.deepEqual(plan.action, { kind: "pause" });
});

test("states that already make sense are left alone", () => {
    for (const state of ["pending", "waiting_wifi", "paused", "failed"]) {
        assert.deepEqual(
            planTransferRecovery(observe({ state })).action,
            { kind: "keep" },
            state
        );
    }
});

test("an unreadable payload fails the job instead of dropping it silently", () => {
    const plan = planTransferRecovery(
        observe({ payloadValid: false, finalFileExists: true })
    );
    assert.deepEqual(plan.action, { kind: "fail", code: "io_error" });
    assert.equal(plan.discardFinalFile, true);
});

test("a committed row outranks an unreadable payload", () => {
    // Order of checks is the specification: the row is the stronger evidence.
    const plan = planTransferRecovery(
        observe({ payloadValid: false, videoRowExists: true })
    );
    assert.equal(plan.action.kind, "dropJob");
});

test("a verified descriptor with no file on disk falls back to the state rules", () => {
    const paused = planTransferRecovery(
        observe({ hasVerifiedOutput: true, finalFileExists: false, state: "running" })
    );
    assert.deepEqual(paused.action, { kind: "pause" });
    assert.equal(paused.discardFinalFile, false);

    const kept = planTransferRecovery(
        observe({ hasVerifiedOutput: true, finalFileExists: false, state: "failed" })
    );
    assert.deepEqual(kept.action, { kind: "keep" });
});

test("every combination produces a decision", () => {
    const flags = [true, false];
    let count = 0;
    for (const state of STATES) {
        for (const payloadValid of flags) {
            for (const hasVerifiedOutput of flags) {
                for (const finalFileExists of flags) {
                    for (const finalFileMatchesOutput of flags) {
                        for (const videoRowExists of flags) {
                            const plan = planTransferRecovery(
                                observe({
                                    state,
                                    payloadValid,
                                    hasVerifiedOutput,
                                    finalFileExists,
                                    finalFileMatchesOutput,
                                    videoRowExists,
                                })
                            );
                            assert.ok(
                                ["dropJob", "finalize", "pause", "fail", "keep"].includes(
                                    plan.action.kind
                                )
                            );
                            assert.equal(typeof plan.discardFinalFile, "boolean");
                            count += 1;
                        }
                    }
                }
            }
        }
    }
    assert.equal(count, STATES.length * 32);
});

test("finalizing never happens without a file to finalize", () => {
    // The one outcome that creates a videos row. It must require both a
    // verified descriptor and a file that still matches it.
    const flags = [true, false];
    for (const state of STATES) {
        for (const hasVerifiedOutput of flags) {
            for (const finalFileExists of flags) {
                for (const finalFileMatchesOutput of flags) {
                    const plan = planTransferRecovery(
                        observe({
                            state,
                            hasVerifiedOutput,
                            finalFileExists,
                            finalFileMatchesOutput,
                        })
                    );
                    if (plan.action.kind === "finalize") {
                        assert.ok(hasVerifiedOutput && finalFileExists && finalFileMatchesOutput);
                    }
                }
            }
        }
    }
});

test("a batch keeps input order", () => {
    const plans = planTransferRecoveries([
        observe({ jobId: "a" }),
        observe({ jobId: "b", videoRowExists: true }),
    ]);
    assert.deepEqual(plans.map((plan) => plan.jobId), ["a", "b"]);
    assert.equal(plans[1].action.kind, "dropJob");
});
