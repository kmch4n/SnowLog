// Compiles the real `src/utils/managedVideoPath.ts` and exercises it.
//
// The module is import-free on purpose, so a plain `tsc <file>` emits flat and
// this recipe stays a two-liner. Adding an import to it breaks the emit path.
// See helpers/repositoryHarness.cjs and .memory/testing.md.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-path-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/managedVideoPath.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const {
    buildManagedVideoPath,
    inferManagedExtension,
    isSafeVideoId,
    validateManagedVideoPath,
} = require(path.join(outDir, "managedVideoPath.js"));

// --- extension inference -------------------------------------------------
// These cases mirror `inferExtension` in managedVideoFileService.ts. If that
// regex ever changes, the backfill starts pointing at paths that do not exist,
// so the two must be checked against each other by hand when either moves.

test("the extension comes from the last dotted segment", () => {
    assert.equal(inferManagedExtension("clip.mp4"), "mp4");
    assert.equal(inferManagedExtension("my.video.mp4"), "mp4");
});

test("an extension is lowercased", () => {
    assert.equal(inferManagedExtension("CLIP.MOV"), "mov");
});

test("a query suffix does not become part of the extension", () => {
    assert.equal(inferManagedExtension("clip.mp4?v=2"), "mp4");
});

test("a name with no readable extension falls back to mov", () => {
    assert.equal(inferManagedExtension("clip"), "mov");
    assert.equal(inferManagedExtension(""), "mov");
    assert.equal(inferManagedExtension(null), "mov");
    assert.equal(inferManagedExtension("clip."), "mov");
});

// --- id safety -----------------------------------------------------------

test("a UUID is a safe video id", () => {
    assert.equal(isSafeVideoId("2f1c9a44-6b2e-4a51-9f0d-1c2b3d4e5f60"), true);
});

test("anything that could escape the directory is not a safe id", () => {
    for (const bad of ["", "..", "a/b", "a\\b", "a.b", "a b", "a:b", "../a"]) {
        assert.equal(isSafeVideoId(bad), false, `expected ${JSON.stringify(bad)} to be unsafe`);
    }
});

// --- path construction ---------------------------------------------------

test("a path is built under videos/ from the id and extension", () => {
    assert.equal(buildManagedVideoPath("abc", "clip.mp4"), "videos/abc.mp4");
    assert.equal(buildManagedVideoPath("abc", null), "videos/abc.mov");
});

test("an unsafe id yields no path at all", () => {
    assert.equal(buildManagedVideoPath("../abc", "clip.mp4"), null);
    assert.equal(buildManagedVideoPath("", "clip.mp4"), null);
});

test("a built path validates for its own id", () => {
    const built = buildManagedVideoPath("abc", "clip.MP4");
    assert.equal(validateManagedVideoPath(built, "abc"), true);
});

// --- ownership validation ------------------------------------------------

test("managed paths cannot escape or borrow another video's file", () => {
    assert.equal(validateManagedVideoPath("videos/a.mov", "a"), true);
    assert.equal(validateManagedVideoPath("videos/b.mov", "a"), false);
    assert.equal(validateManagedVideoPath("videos/../a.mov", "a"), false);
    assert.equal(validateManagedVideoPath("https://example.com/a.mov", "a"), false);
});

test("a path outside videos/ is refused", () => {
    assert.equal(validateManagedVideoPath("a.mov", "a"), false);
    assert.equal(validateManagedVideoPath("thumbnails/a.mov", "a"), false);
    assert.equal(validateManagedVideoPath("/videos/a.mov", "a"), false);
    assert.equal(validateManagedVideoPath("file:///videos/a.mov", "a"), false);
});

test("a nested path is refused even under videos/", () => {
    assert.equal(validateManagedVideoPath("videos/sub/a.mov", "a"), false);
});

test("a missing or unusable extension is refused", () => {
    assert.equal(validateManagedVideoPath("videos/a", "a"), false);
    assert.equal(validateManagedVideoPath("videos/a.", "a"), false);
    assert.equal(validateManagedVideoPath("videos/.mov", "a"), false);
    assert.equal(validateManagedVideoPath("videos/a.m ov", "a"), false);
});

test("a legacy extension outside the new output formats still validates", () => {
    // Task D restricts new output to mov/mp4/m4v. Tightening it here instead
    // would orphan rows written before that rule existed (#86 section 5).
    assert.equal(validateManagedVideoPath("videos/a.avi", "a"), true);
    assert.equal(validateManagedVideoPath("videos/a.3gp", "a"), true);
});

test("an unsafe id never validates, whatever the path says", () => {
    assert.equal(validateManagedVideoPath("videos/../a.mov", "../a"), false);
});
