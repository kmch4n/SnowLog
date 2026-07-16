const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-photos-errors-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

process.on("exit", () => {
    fs.rmSync(outDir, { recursive: true, force: true });
});

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/utils/photosErrors.ts",
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

test.after(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
});

// photosErrors.ts imports nothing, so the emit stays flat here. Adding an
// import to it would nest this under out/utils/ and break the require.
const { isPhotosLibraryError } = require(path.join(outDir, "photosErrors.js"));

test("isPhotosLibraryError accepts the code seen on this device", () => {
    // The regression this predicate exists for: an iCloud-only video reports
    // 3163, and pinning 3164 let it through as an unhandled failure.
    assert.equal(
        isPhotosLibraryError(
            new Error("The operation couldn’t be completed. (PHPhotosErrorDomain error 3163.)")
        ),
        true
    );
});

test("isPhotosLibraryError accepts the code reported upstream", () => {
    assert.equal(
        isPhotosLibraryError(
            new Error("The operation couldn’t be completed. (PHPhotosErrorDomain error 3164.)")
        ),
        true
    );
});

test("isPhotosLibraryError accepts any code from the Photos domain", () => {
    // Matching the domain rather than a list of numbers is the whole point: a
    // code nobody has seen yet must not slip through.
    assert.equal(
        isPhotosLibraryError(new Error("(PHPhotosErrorDomain error 3311.)")),
        true
    );
    assert.equal(
        isPhotosLibraryError(new Error("(PHPhotosErrorDomain error 9999.)")),
        true
    );
});

test("isPhotosLibraryError accepts an error thrown as a bare string", () => {
    assert.equal(
        isPhotosLibraryError("PHPhotosErrorDomain error 3163"),
        true
    );
});

test("isPhotosLibraryError accepts the domain on the code property", () => {
    assert.equal(isPhotosLibraryError({ code: "PHPhotosErrorDomain" }), true);
    assert.equal(isPhotosLibraryError({ code: "E_PHOTOS_ERROR" }), true);
});

test("isPhotosLibraryError rejects a bare error number without the domain", () => {
    // Deliberately narrower than the predicate it replaces, which matched the
    // digits "3164" anywhere. A number on its own says nothing about Photos.
    assert.equal(isPhotosLibraryError("3164"), false);
    assert.equal(isPhotosLibraryError(new Error("failed with 3163")), false);
});

test("isPhotosLibraryError rejects unrelated failures", () => {
    assert.equal(isPhotosLibraryError(new Error("Network request failed")), false);
    assert.equal(isPhotosLibraryError({ code: "ERR_CANCELED" }), false);
    assert.equal(isPhotosLibraryError(new TypeError("undefined is not a function")), false);
});

test("isPhotosLibraryError rejects absent and non-error values", () => {
    assert.equal(isPhotosLibraryError(null), false);
    assert.equal(isPhotosLibraryError(undefined), false);
    assert.equal(isPhotosLibraryError(42), false);
    assert.equal(isPhotosLibraryError({}), false);
    assert.equal(isPhotosLibraryError({ message: 42 }), false);
});
