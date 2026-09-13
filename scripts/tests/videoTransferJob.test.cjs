// The transfer job state machine from #86 section 6, exhaustively.
//
// Every state/event pair is asserted, including the ones that do nothing:
// silently ignoring a late native callback is the intended behaviour, and a
// table with holes in it is how that turns into a crash later.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-job-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/services/videoTransferJob.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const {
    VIDEO_TRANSFER_JOB_STATES,
    applyVideoTransferEvent,
    isVideoTransferJobKind,
    isVideoTransferJobState,
    needsRecovery,
    parseVideoTransferPayload,
    serializeVideoTransferPayload,
} = require(path.join(outDir, "services", "videoTransferJob.js"));

const EVENTS = [
    { type: "start" },
    { type: "retry" },
    { type: "needsWifi" },
    { type: "wifiEligible" },
    { type: "background" },
    { type: "fail", code: "io_error" },
    { type: "cancel" },
    { type: "complete" },
];

function to(state, event) {
    return applyVideoTransferEvent(state, event);
}

// --- the documented transitions -----------------------------------------

test("a pending job starts", () => {
    assert.deepEqual(to("pending", { type: "start" }), {
        kind: "state",
        state: "running",
        errorCode: null,
    });
});

test("a running job that needs the network waits for Wi-Fi", () => {
    assert.deepEqual(to("running", { type: "needsWifi" }), {
        kind: "state",
        state: "waiting_wifi",
        errorCode: null,
    });
});

test("an eligible path returns a waiting job to pending, not to running", () => {
    // Eligibility alone must not dispatch: whether a foreground queue is still
    // active is the caller's knowledge, not the state machine's (#86 §12).
    assert.deepEqual(to("waiting_wifi", { type: "wifiEligible" }), {
        kind: "state",
        state: "pending",
        errorCode: null,
    });
});

test("backgrounding pauses anything still in flight", () => {
    for (const state of ["pending", "running", "waiting_wifi"]) {
        assert.deepEqual(
            to(state, { type: "background" }),
            { kind: "state", state: "paused", errorCode: null },
            state
        );
    }
});

test("a failure records its code", () => {
    assert.deepEqual(to("running", { type: "fail", code: "insufficient_space" }), {
        kind: "state",
        state: "failed",
        errorCode: "insufficient_space",
    });
});

test("completion removes the job, and says why", () => {
    assert.deepEqual(to("running", { type: "complete" }), {
        kind: "removed",
        reason: "completed",
    });
});

test("cancelling removes the job from every retained state", () => {
    for (const state of VIDEO_TRANSFER_JOB_STATES) {
        assert.deepEqual(
            to(state, { type: "cancel" }),
            { kind: "removed", reason: "cancelled" },
            state
        );
    }
});

test("completion and cancellation are not the same removal", () => {
    // One means a videos row now exists; the other means the intent was
    // withdrawn. A caller that conflates them reports phantom imports.
    assert.notEqual(
        to("running", { type: "complete" }).reason,
        to("running", { type: "cancel" }).reason
    );
});

test("retry clears the old failure code", () => {
    const retried = to("failed", { type: "retry" });
    assert.deepEqual(retried, { kind: "state", state: "pending", errorCode: null });
});

test("every retained state can be retried back to pending", () => {
    for (const state of ["waiting_wifi", "paused", "failed"]) {
        assert.deepEqual(
            to(state, { type: "retry" }),
            { kind: "state", state: "pending", errorCode: null },
            state
        );
    }
});

// --- the holes, on purpose ----------------------------------------------

test("an event that does not apply is ignored, never thrown", () => {
    // Late native callbacks are routine. Throwing here pushes the caller into
    // a catch-all, which is where real failures go to die.
    const ignored = [
        ["pending", { type: "complete" }],
        ["pending", { type: "needsWifi" }],
        ["pending", { type: "wifiEligible" }],
        ["running", { type: "start" }],
        ["running", { type: "retry" }],
        ["waiting_wifi", { type: "start" }],
        ["waiting_wifi", { type: "complete" }],
        ["paused", { type: "start" }],
        ["paused", { type: "complete" }],
        ["paused", { type: "wifiEligible" }],
        ["failed", { type: "start" }],
        ["failed", { type: "complete" }],
        ["failed", { type: "needsWifi" }],
    ];
    for (const [state, event] of ignored) {
        assert.deepEqual(
            to(state, event),
            { kind: "ignored" },
            `${state} + ${event.type}`
        );
    }
});

test("a finished job cannot be resurrected by a late completion", () => {
    // There is no state to apply the event to once the row is gone; the guard
    // is that "removed" is terminal for the caller. Assert the neighbours: a
    // paused or failed job never completes on its own.
    assert.deepEqual(to("paused", { type: "complete" }), { kind: "ignored" });
    assert.deepEqual(to("failed", { type: "complete" }), { kind: "ignored" });
});

test("every state and event pair is decided", () => {
    for (const state of VIDEO_TRANSFER_JOB_STATES) {
        for (const event of EVENTS) {
            const result = to(state, event);
            assert.ok(
                result && ["state", "removed", "ignored"].includes(result.kind),
                `${state} + ${event.type} produced ${JSON.stringify(result)}`
            );
        }
    }
});

// --- recovery and guards -------------------------------------------------

test("only a running job looks like a crash on restart", () => {
    assert.equal(needsRecovery("running"), true);
    for (const state of ["pending", "waiting_wifi", "paused", "failed"]) {
        assert.equal(needsRecovery(state), false, state);
    }
});

test("states and kinds read back from the database are validated", () => {
    for (const state of VIDEO_TRANSFER_JOB_STATES) {
        assert.equal(isVideoTransferJobState(state), true);
    }
    for (const bad of ["", "RUNNING", "done", null, undefined, 1, {}]) {
        assert.equal(isVideoTransferJobState(bad), false, JSON.stringify(bad));
    }
    assert.equal(isVideoTransferJobKind("import"), true);
    assert.equal(isVideoTransferJobKind("convert"), true);
    for (const bad of ["Import", "copy", null, undefined]) {
        assert.equal(isVideoTransferJobKind(bad), false, JSON.stringify(bad));
    }
});

// --- the stored payload --------------------------------------------------

function makePayload(overrides = {}) {
    return {
        version: 1,
        asset: {
            assetId: "PHAsset-1",
            filename: "clip.mov",
            capturedAt: 1706774400,
            duration: 12,
            width: 1920,
            height: 1080,
            modificationTime: 1706774400,
            location: null,
        },
        metadata: {
            title: null,
            skiResortName: "白馬八方尾根",
            memo: "",
            tagIds: [1, 2],
            techniques: ["carving"],
        },
        storageIntent: "copy",
        managedVideoPath: "videos/v1.mov",
        output: null,
        ...overrides,
    };
}

test("a payload survives a round trip", () => {
    const payload = makePayload();
    const parsed = parseVideoTransferPayload(
        serializeVideoTransferPayload(payload)
    );
    assert.deepEqual(parsed, payload);
});

test("a verified output descriptor round trips too", () => {
    const payload = makePayload({
        output: { bytes: 1024, extension: "mov", duration: 12, width: 1920, height: 1080 },
    });
    const parsed = parseVideoTransferPayload(
        serializeVideoTransferPayload(payload)
    );
    assert.deepEqual(parsed.output, payload.output);
});

test("a conversion job carries no import metadata", () => {
    const payload = makePayload({ metadata: null });
    const parsed = parseVideoTransferPayload(
        serializeVideoTransferPayload(payload)
    );
    assert.equal(parsed.metadata, null);
});

test("a payload the app cannot trust parses as null, not a throw", () => {
    // These rows outlive app versions. Failing the one job and showing it is
    // better than an exception on a screen that lists all of them.
    const bad = [
        "",
        "{",
        "null",
        "[]",
        JSON.stringify({ ...makePayload(), version: 2 }),
        JSON.stringify({ ...makePayload(), storageIntent: "reference" }),
        JSON.stringify({ ...makePayload(), managedVideoPath: null }),
        JSON.stringify({ ...makePayload(), asset: { assetId: "a" } }),
        JSON.stringify({ ...makePayload(), asset: null }),
        JSON.stringify({ ...makePayload(), metadata: { memo: 1 } }),
        JSON.stringify({ ...makePayload(), output: { bytes: 0 } }),
        JSON.stringify({
            ...makePayload(),
            asset: { ...makePayload().asset, capturedAt: NaN },
        }),
    ];
    for (const raw of bad) {
        assert.equal(parseVideoTransferPayload(raw), null, raw.slice(0, 60));
    }
});

test("a payload never carries a network grant or an external url", () => {
    // #86 section 12: permission is scoped to one attempt. Persisting it would
    // turn it into standing consent for a later, unattended request.
    const serialized = serializeVideoTransferPayload(makePayload());
    assert.equal(/networkAccess|allow|http/i.test(serialized), false, serialized);
});
