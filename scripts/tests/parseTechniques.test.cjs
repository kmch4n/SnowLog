const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-parse-techniques-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/utils/parseTechniques.ts",
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

const { parseTechniques } = require(path.join(outDir, "parseTechniques.js"));

test("parseTechniques returns the string list for a valid JSON array", () => {
    assert.deepEqual(parseTechniques('["Carving","Mogul"]'), ["Carving", "Mogul"]);
    assert.deepEqual(parseTechniques('["Carving"]'), ["Carving"]);
});

test("parseTechniques treats absent values as null", () => {
    assert.equal(parseTechniques(null), null);
    assert.equal(parseTechniques(""), null);
});

test("parseTechniques returns null for malformed JSON instead of throwing", () => {
    assert.equal(parseTechniques("not json"), null);
    assert.equal(parseTechniques('["unterminated'), null);
});

test("parseTechniques rejects JSON that is not an array", () => {
    assert.equal(parseTechniques('{"a":1}'), null);
    assert.equal(parseTechniques('"Carving"'), null);
    assert.equal(parseTechniques("42"), null);
    assert.equal(parseTechniques("null"), null);
});

test("parseTechniques drops non-string entries and nulls out an empty result", () => {
    assert.deepEqual(parseTechniques('["Carving",1,null,"Mogul"]'), [
        "Carving",
        "Mogul",
    ]);
    assert.equal(parseTechniques("[]"), null);
    assert.equal(parseTechniques("[1,2,3]"), null);
});
