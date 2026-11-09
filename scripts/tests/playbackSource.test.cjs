// What the detail screen does with the result of resolving a video's source (#87).
//
// The two properties a reporter on #87 asked to pin down: a video that cannot be
// resolved under Limited Photos access is never written off as missing, and a
// row already marked missing flips back only when resolution actually succeeds.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-playback-source-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/playbackSource.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const { decidePlaybackSource, isOutsideLimitedSelection } = require(
    path.join(outDir, "playbackSource.js")
);

test("unresolved under Limited access is not written off as missing", () => {
    for (const wasAvailable of [true, false]) {
        assert.deepEqual(
            decidePlaybackSource({ resolved: false, access: "limited", wasAvailable }),
            { kind: "notAccessible" }
        );
    }
});

test("unresolved with no Photos access is not written off as missing either", () => {
    assert.deepEqual(
        decidePlaybackSource({ resolved: false, access: "none", wasAvailable: true }),
        { kind: "notAccessible" }
    );
});

test("a row marked missing flips back only when resolution succeeds", () => {
    assert.deepEqual(
        decidePlaybackSource({ resolved: true, access: "all", wasAvailable: false }),
        { kind: "play", markAvailable: true }
    );
    // Regaining full access is not enough on its own: no resolution, no flip.
    assert.deepEqual(
        decidePlaybackSource({ resolved: false, access: "all", wasAvailable: false }),
        { kind: "missing", markMissing: false }
    );
});

test("a resolved row that was already available writes nothing", () => {
    assert.deepEqual(
        decidePlaybackSource({ resolved: true, access: "limited", wasAvailable: true }),
        { kind: "play", markAvailable: false }
    );
});

test("unresolved with full access is a genuinely missing file", () => {
    assert.deepEqual(
        decidePlaybackSource({ resolved: false, access: "all", wasAvailable: true }),
        { kind: "missing", markMissing: true }
    );
});

// Import time (#91): a pick that the library cannot find under Limited access is
// refused, because the row would be an unplayable reference.

test("a pick not found under Limited access is outside the selection", () => {
    assert.equal(
        isOutsideLimitedSelection({ assetId: "A/L0/001", access: "limited", lookup: "notFound" }),
        true
    );
});

test("only Limited access refuses a pick; Full and no access keep today's import", () => {
    for (const access of ["all", "none"]) {
        assert.equal(
            isOutsideLimitedSelection({ assetId: "A/L0/001", access, lookup: "notFound" }),
            false,
            access
        );
    }
});

test("a lookup that failed or found the asset is not treated as outside", () => {
    for (const lookup of ["found", "failed"]) {
        assert.equal(
            isOutsideLimitedSelection({ assetId: "A/L0/001", access: "limited", lookup }),
            false,
            lookup
        );
    }
});

test("a pick without a library identifier is never outside (it becomes an app copy)", () => {
    for (const assetId of [null, undefined, ""]) {
        assert.equal(
            isOutsideLimitedSelection({ assetId, access: "limited", lookup: "notFound" }),
            false
        );
    }
});
