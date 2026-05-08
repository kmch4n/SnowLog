const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-version-utils-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/utils/versionUtils.ts",
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

const { isRemoteVersionNewer } = require(path.join(
    outDir,
    "versionUtils.js"
));

test("isRemoteVersionNewer detects patch, minor, and major updates", () => {
    assert.equal(isRemoteVersionNewer("1.2.0", "1.2.1"), true);
    assert.equal(isRemoteVersionNewer("1.2.0", "1.3.0"), true);
    assert.equal(isRemoteVersionNewer("1.2.0", "2.0.0"), true);
});

test("isRemoteVersionNewer compares dotted numbers numerically", () => {
    assert.equal(isRemoteVersionNewer("1.9.0", "1.10.0"), true);
    assert.equal(isRemoteVersionNewer("1.10.0", "1.9.9"), false);
});

test("isRemoteVersionNewer ignores equal or older remote versions", () => {
    assert.equal(isRemoteVersionNewer("1.2.0", "1.2.0"), false);
    assert.equal(isRemoteVersionNewer("1.2.1", "1.2.0"), false);
    assert.equal(isRemoteVersionNewer("1.2.0", "1.2"), false);
});

test("isRemoteVersionNewer treats prerelease suffixes as their base version", () => {
    assert.equal(isRemoteVersionNewer("1.2.0", "1.3.0-beta.1"), true);
    assert.equal(isRemoteVersionNewer("1.3.0", "1.3.0-beta.1"), false);
});
