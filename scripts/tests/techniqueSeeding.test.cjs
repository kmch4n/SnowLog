// Default technique seeding (_layout.tsx → planTechniqueSeed) and appending a new
// technique (techniqueOptionRepository.insertTechniqueOption).
//
// Before: every launch re-inserted any default missing from the table, so a default
// the user deleted came back on the next launch; and a new technique took the row
// count as its sortOrder, colliding with an existing one after a deletion.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createRepositoryHarness } = require("./helpers/repositoryHarness.cjs");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-technique-seed-"));
test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));
execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/techniqueSeeding.ts",
        "--outDir", outDir, "--target", "ES2020", "--module", "commonjs", "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);
const { planTechniqueSeed, parseSeededTechniqueNames } = require(
    path.join(outDir, "techniqueSeeding.js")
);

const DEFAULTS = ["大回り", "小回り", "コブ"];

test("a fresh install seeds every default and records them", () => {
    assert.deepEqual(planTechniqueSeed(DEFAULTS, new Set(), null), {
        toInsert: DEFAULTS,
        seeded: DEFAULTS,
    });
});

test("a deleted default is not seeded again", () => {
    const plan = planTechniqueSeed(DEFAULTS, new Set(["大回り", "コブ"]), DEFAULTS);
    assert.deepEqual(plan.toInsert, []);
    assert.deepEqual(plan.seeded, DEFAULTS);
});

test("an upgrade from the version without a record re-adds nothing", () => {
    // The old code restored missing defaults on every launch, so one missing now was
    // deleted in the previous session.
    const plan = planTechniqueSeed(DEFAULTS, new Set(["大回り", "自分の種別"]), null);
    assert.deepEqual(plan.toInsert, []);
    assert.deepEqual(plan.seeded, DEFAULTS);
});

test("a default added in a later version is seeded once", () => {
    const later = [...DEFAULTS, "パーク"];
    const plan = planTechniqueSeed(later, new Set(["大回り"]), DEFAULTS);
    assert.deepEqual(plan.toInsert, ["パーク"]);
    assert.deepEqual(plan.seeded, later);
    // Next launch, after the user deleted it again.
    assert.deepEqual(planTechniqueSeed(later, new Set(["大回り"]), plan.seeded).toInsert, []);
});

test("a new default that the user already created by hand is not duplicated", () => {
    const later = [...DEFAULTS, "パーク"];
    const plan = planTechniqueSeed(later, new Set(["パーク"]), DEFAULTS);
    assert.deepEqual(plan.toInsert, []);
    assert.deepEqual(plan.seeded, later);
});

test("the stored record is read leniently", () => {
    assert.deepEqual(parseSeededTechniqueNames('["a","b"]'), ["a", "b"]);
    assert.equal(parseSeededTechniqueNames(null), null);
    assert.equal(parseSeededTechniqueNames("not json"), null);
    assert.equal(parseSeededTechniqueNames('{"a":1}'), null);
    assert.equal(parseSeededTechniqueNames('["a",1]'), null);
});

const harness = createRepositoryHarness(
    ["src/database/repositories/techniqueOptionRepository.ts"],
    { driver: "expo-sqlite" }
);
const { insertTechniqueOption, getAllTechniqueOptions, deleteTechniqueOption } = harness.load(
    "database/repositories/techniqueOptionRepository.js"
);
test.after(() => harness.cleanup());

test("a technique added after deletions goes last, with a fresh sort order", async () => {
    harness.sqlite.exec("DELETE FROM technique_options");
    for (const name of ["A", "B", "C", "D", "E"]) await insertTechniqueOption(name);
    const rows = await getAllTechniqueOptions();
    await deleteTechniqueOption(rows.find((r) => r.name === "A").id);
    await deleteTechniqueOption(rows.find((r) => r.name === "B").id);

    await insertTechniqueOption("F");

    const after = await getAllTechniqueOptions();
    assert.deepEqual(after.map((r) => r.name), ["C", "D", "E", "F"]);
    const orders = after.map((r) => r.sortOrder);
    assert.equal(new Set(orders).size, orders.length, `duplicate sortOrder: ${orders}`);
});

test("the first technique in an empty table gets sort order 0", async () => {
    harness.sqlite.exec("DELETE FROM technique_options");
    await insertTechniqueOption("only");
    assert.deepEqual((await getAllTechniqueOptions()).map((r) => r.sortOrder), [0]);
});
