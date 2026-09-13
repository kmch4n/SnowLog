// The acquisition gate from #86 section 12.
//
// This is the rule the whole feature was judged against: does the operation
// still work with the Photos app's mobile data switched off. What the gate can
// actually promise is narrower than that — it decides what the app *requests*,
// not which interface PhotoKit ends up using (§12.6) — and the tests are
// written to keep that distinction visible.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-policy-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/mediaPolicy.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const {
    decideAcquisition,
    isEligibleWifiPath,
    shouldCancelOnPathLoss,
    toNetworkAccess,
} = require(path.join(outDir, "mediaPolicy.js"));

function goodWifi(overrides = {}) {
    return {
        hasCurrentPath: true,
        isSatisfied: true,
        usesWifi: true,
        isExpensive: false,
        isConstrained: false,
        hasCellular: false,
        ...overrides,
    };
}

function request(overrides = {}) {
    return {
        priority: "save_data",
        path: goodWifi(),
        intentActive: true,
        needsNetwork: true,
        hasConfirmedThisAttempt: false,
        ...overrides,
    };
}

// --- eligibility ---------------------------------------------------------

test("an unrestricted Wi-Fi path is eligible", () => {
    assert.equal(isEligibleWifiPath(goodWifi()), true);
});

test("every disqualifying condition makes the path ineligible", () => {
    const disqualifiers = [
        { hasCurrentPath: false },
        { isSatisfied: false },
        { usesWifi: false },
        { isExpensive: true },
        { isConstrained: true },
        { hasCellular: true },
    ];
    for (const bad of disqualifiers) {
        assert.equal(
            isEligibleWifiPath(goodWifi(bad)),
            false,
            JSON.stringify(bad)
        );
    }
});

test("no observation yet is ineligible, not optimistically eligible", () => {
    // Treating "unknown" as Wi-Fi opens a window right after launch where the
    // gate is simply not applied.
    assert.equal(isEligibleWifiPath(goodWifi({ hasCurrentPath: false })), false);
});

test("a visible Wi-Fi connection is not automatically eligible", () => {
    // Expensive or constrained Wi-Fi is common: a phone hotspot, or Low Data
    // Mode. The wording shown to the user has to match this (§3.2).
    assert.equal(isEligibleWifiPath(goodWifi({ isExpensive: true })), false);
    assert.equal(isEligibleWifiPath(goodWifi({ isConstrained: true })), false);
});

// --- the decision --------------------------------------------------------

test("anything available locally never involves the network", () => {
    // The premise of the whole feature: a video already on the device plays
    // with Photos' mobile data switched off, in either priority.
    for (const priority of ["save_space", "save_data", null]) {
        for (const intentActive of [true, false]) {
            assert.deepEqual(
                decideAcquisition(
                    request({ priority, intentActive, needsNetwork: false })
                ),
                { kind: "local" },
                `${priority}/${intentActive}`
            );
        }
    }
});

test("nothing is fetched without an active user intent", () => {
    // Mounting a screen, scrolling a list, launching the app: none of these
    // may start an acquisition (§3.1).
    assert.deepEqual(decideAcquisition(request({ intentActive: false })), {
        kind: "denied",
        reason: "noIntent",
    });
});

test("an unchosen priority is fail-closed", () => {
    assert.deepEqual(decideAcquisition(request({ priority: null })), {
        kind: "denied",
        reason: "noPriority",
    });
});

test("mobile-data priority dispatches only on an eligible path", () => {
    assert.deepEqual(decideAcquisition(request()), { kind: "network" });
});

test("mobile-data priority waits rather than failing when ineligible", () => {
    for (const bad of [
        { usesWifi: false },
        { isExpensive: true },
        { isConstrained: true },
        { hasCellular: true },
        { hasCurrentPath: false },
        { isSatisfied: false },
    ]) {
        assert.deepEqual(
            decideAcquisition(request({ path: goodWifi(bad) })),
            { kind: "waitWifi" },
            JSON.stringify(bad)
        );
    }
});

test("device-storage priority asks before it may use mobile data", () => {
    assert.deepEqual(
        decideAcquisition(request({ priority: "save_space" })),
        { kind: "needsConsent" }
    );
});

test("device-storage priority dispatches once that attempt is confirmed", () => {
    assert.deepEqual(
        decideAcquisition(
            request({ priority: "save_space", hasConfirmedThisAttempt: true })
        ),
        { kind: "network" }
    );
});

test("device-storage consent is not bound to Wi-Fi eligibility", () => {
    // It is consent to spend data, so an ineligible path does not block it.
    assert.deepEqual(
        decideAcquisition(
            request({
                priority: "save_space",
                hasConfirmedThisAttempt: true,
                path: goodWifi({ usesWifi: false, hasCellular: true }),
            })
        ),
        { kind: "network" }
    );
});

test("consent from one attempt does not carry to a request without it", () => {
    const denied = decideAcquisition(
        request({ priority: "save_space", hasConfirmedThisAttempt: false })
    );
    assert.deepEqual(denied, { kind: "needsConsent" });
});

// --- the native boundary -------------------------------------------------

test("only a dispatch decision becomes allow; everything else is an explicit deny", () => {
    assert.equal(toNetworkAccess({ kind: "network" }), "allow");
    for (const decision of [
        { kind: "local" },
        { kind: "waitWifi" },
        { kind: "needsConsent" },
        { kind: "denied", reason: "noPriority" },
        { kind: "denied", reason: "noIntent" },
    ]) {
        assert.equal(toNetworkAccess(decision), "deny", decision.kind);
    }
});

// --- losing the path mid-transfer ---------------------------------------

test("a mobile-data transfer stops when the path stops being eligible", () => {
    assert.equal(
        shouldCancelOnPathLoss("save_data", true, goodWifi({ usesWifi: false })),
        true
    );
});

test("a local transfer keeps going when Wi-Fi disappears", () => {
    // Nothing is crossing the network, so there is nothing to stop.
    assert.equal(
        shouldCancelOnPathLoss("save_data", false, goodWifi({ usesWifi: false })),
        false
    );
});

test("a confirmed device-storage transfer does not inherit the Wi-Fi rule", () => {
    assert.equal(
        shouldCancelOnPathLoss("save_space", true, goodWifi({ usesWifi: false })),
        false
    );
});

test("an eligible path does not cancel anything", () => {
    assert.equal(shouldCancelOnPathLoss("save_data", true, goodWifi()), false);
});
