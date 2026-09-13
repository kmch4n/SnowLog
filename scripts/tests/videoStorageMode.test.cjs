// Compiles the real `src/utils/videoStorageMode.ts` and exercises it.
// Import-free on purpose so a plain `tsc <file>` emits flat — see
// .memory/testing.md and utils/assetId.ts for the same constraint.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-mode-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/videoStorageMode.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const {
    VIDEO_STORAGE_MODES,
    isVideoStorageMode,
    normalizeVideoStorageMode,
} = require(path.join(outDir, "videoStorageMode.js"));

test("both storage modes are enumerated", () => {
    assert.deepEqual([...VIDEO_STORAGE_MODES].sort(), ["copy", "reference"]);
});

test("only the two documented values are storage modes", () => {
    for (const good of VIDEO_STORAGE_MODES) {
        assert.equal(isVideoStorageMode(good), true);
    }
    for (const bad of ["", "Reference", "COPY", "managed", null, undefined, 0, 1, {}, []]) {
        assert.equal(
            isVideoStorageMode(bad),
            false,
            `expected ${JSON.stringify(bad)} to be rejected`
        );
    }
});

test("a valid mode normalizes to itself", () => {
    assert.equal(normalizeVideoStorageMode("reference"), "reference");
    assert.equal(normalizeVideoStorageMode("copy"), "copy");
});

test("an unknown mode falls back to reference, never copy", () => {
    // Falling back to copy would make the app claim to own a file it does not
    // have; reference lands on the existing "not found in Photos" path instead.
    for (const bad of ["", "COPY", "managed", null, undefined, 7, {}]) {
        assert.equal(
            normalizeVideoStorageMode(bad),
            "reference",
            `expected ${JSON.stringify(bad)} to normalize to reference`
        );
    }
});
