const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-bulk-import-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/utils/bulkImportProgressUtils.ts",
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

const {
    estimateBulkImportRemainingMs,
    formatElapsedMmSs,
    formatRemainingTime,
} = require(path.join(outDir, "bulkImportProgressUtils.js"));

test("estimateBulkImportRemainingMs returns null until at least one item has completed", () => {
    assert.equal(
        estimateBulkImportRemainingMs({
            completedCount: 0,
            totalCount: 5,
            elapsedMs: 10_000,
            nowMs: 10_000,
        }),
        null
    );
});

test("estimateBulkImportRemainingMs estimates remaining time from the completed average", () => {
    assert.equal(
        estimateBulkImportRemainingMs({
            completedCount: 2,
            totalCount: 5,
            elapsedMs: 20_000,
            nowMs: 30_000,
        }),
        30_000
    );
});

test("estimateBulkImportRemainingMs includes the current item elapsed time", () => {
    assert.equal(
        estimateBulkImportRemainingMs({
            completedCount: 2,
            totalCount: 5,
            elapsedMs: 20_000,
            nowMs: 35_000,
            currentItemStartedAtMs: 30_000,
        }),
        25_000
    );
});

test("formatRemainingTime rounds up seconds and switches to minutes", () => {
    assert.equal(
        formatRemainingTime(4_200, (key, params) => `${key}:${params.count}`),
        "import.bulk.remainingSeconds:5"
    );
    assert.equal(
        formatRemainingTime(90_000, (key, params) => `${key}:${params.count}`),
        "import.bulk.remainingMinutes:2"
    );
});

test("formatElapsedMmSs pads the seconds and truncates the partial second", () => {
    assert.equal(formatElapsedMmSs(0), "0:00");
    assert.equal(formatElapsedMmSs(65_000), "1:05");
    assert.equal(formatElapsedMmSs(600_000), "10:00");
    // Truncates rather than rounds, so the display never jumps ahead of the
    // clock.
    assert.equal(formatElapsedMmSs(59_999), "0:59");
});

test("formatElapsedMmSs clamps a negative elapsed time to zero", () => {
    // The caller subtracts two Date.now() readings, so a backwards system
    // clock adjustment can produce a negative value.
    assert.equal(formatElapsedMmSs(-5_000), "0:00");
});
