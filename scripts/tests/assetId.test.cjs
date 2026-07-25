// src/utils/assetId.ts has no imports, so the plain `tsc <file>` recipe works and
// the emit stays flat (out/assetId.js). See .memory/testing.md before adding any
// import to the target — it moves the emit into out/utils/ and breaks the require
// below.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-asset-id-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/utils/assetId.ts",
        "--outDir",
        outDir,
        "--target",
        "ES2020",
        "--module",
        "commonjs",
        "--esModuleInterop",
        "--skipLibCheck",
    ],
    { cwd: repoRoot, stdio: "inherit" }
);

process.on("exit", () => {
    fs.rmSync(outDir, { recursive: true, force: true });
});

test.after(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
});

const { SYNTHETIC_ASSET_ID_PREFIX, isSyntheticAssetId } = require(
    path.join(outDir, "assetId.js")
);

// The literal is asserted, not read from the module, so a changed prefix fails
// here instead of silently redefining the contract. Values written into the
// videos table by past builds all start with this exact string.
test("the synthetic prefix is exactly 'synthetic:'", () => {
    assert.equal(SYNTHETIC_ASSET_ID_PREFIX, "synthetic:");
});

test("ids produced by the import screen are recognised as synthetic", () => {
    // Shape matches `${SYNTHETIC_ASSET_ID_PREFIX}${randomUUID()}` in video-import.tsx
    assert.equal(
        isSyntheticAssetId("synthetic:3f2504e0-4f89-11d3-9a0c-0305e82c3301"),
        true
    );
});

// MediaLibrary asset ids are opaque strings; on iOS they look like
// "B84E8479-475C-4727-A4A4-B77AA9980897/L0/001". None may be treated as
// synthetic — doing so skips the MediaLibrary lookup and, in
// videoDeletionService, tries to delete a managed copy that does not exist.
test("real MediaLibrary asset ids are not synthetic", () => {
    assert.equal(
        isSyntheticAssetId("B84E8479-475C-4727-A4A4-B77AA9980897/L0/001"),
        false
    );
    assert.equal(isSyntheticAssetId(""), false);
});

// Guards the separator specifically. Dropping the colon from the constant still
// matches every real synthetic id (they all continue "synthetic:<uuid>"), so the
// two tests above stay green — this one is what fails.
test("the colon is part of the prefix", () => {
    assert.equal(isSyntheticAssetId("syntheticfoo"), false);
    assert.equal(isSyntheticAssetId("synthetic"), false);
});

// startsWith, not includes: an id that merely contains the prefix later in the
// string is a real asset id and must not be reclassified.
test("the prefix must be at the start", () => {
    assert.equal(isSyntheticAssetId("prefixed-synthetic:abc"), false);
});
