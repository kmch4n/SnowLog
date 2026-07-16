const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-geo-utils-"));

// geoUtils.ts value-imports "@/constants/skiResorts.json", and tsc does not
// rewrite module specifiers, so the emitted require keeps the "@/" prefix.
// Emitting into node_modules/@ makes Node's own lookup resolve it: the walk up
// from the emitted file reaches this node_modules directory, where "@/constants/
// skiResorts.json" exists because tsc copies the JSON alongside the output. No
// module-resolution hook needed.
const outDir = path.join(tmpRoot, "node_modules", "@");
const tsconfigPath = path.join(tmpRoot, "tsconfig.json");
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

// Registered before the compile so a tsc failure cannot leak the temp tree.
process.on("exit", () => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// A bare `tsc <file>` cannot resolve "@/" and exits non-zero. The project
// tsconfig cannot be extended either: it inherits moduleResolution "bundler"
// from expo/tsconfig.base, which rejects module "commonjs" (TS5095). Paths must
// be absolute because relative ones would resolve against this temp directory.
fs.writeFileSync(
    tsconfigPath,
    JSON.stringify({
        compilerOptions: {
            outDir,
            module: "commonjs",
            moduleResolution: "node",
            target: "ES2020",
            esModuleInterop: true,
            skipLibCheck: true,
            resolveJsonModule: true,
            baseUrl: repoRoot,
            paths: { "@/*": [path.join(repoRoot, "src", "*")] },
            types: [],
        },
        files: [path.join(repoRoot, "src", "utils", "geoUtils.ts")],
    })
);

execFileSync(process.execPath, [tscBin, "--project", tsconfigPath], {
    cwd: repoRoot,
    stdio: "inherit",
});

test.after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

const { haversineKm, findNearbySkiResorts } = require(
    path.join(outDir, "utils", "geoUtils.js")
);

// Nagano: ~50 resorts inside the default 30km threshold. Picked over a sparser
// spot so the ordering assertions have real candidates to get wrong, and so a
// count assertion is not one data edit away from breaking.
const NAGANO = [36.7, 138.3];
const TOKYO = [35.6812, 139.7671];
const OSAKA = [34.7025, 135.4959];

test("haversineKm is exactly zero for a point measured against itself", () => {
    assert.equal(haversineKm(43.07, 140.68, 43.07, 140.68), 0);
    assert.equal(haversineKm(0, 0, 0, 0), 0);
});

test("haversineKm is symmetric", () => {
    assert.equal(
        haversineKm(43.0, 141.0, 35.0, 139.0),
        haversineKm(35.0, 139.0, 43.0, 141.0)
    );
});

test("haversineKm matches the real Tokyo-Osaka great-circle distance", () => {
    // Tight on purpose: a loose "roughly 400km" band still passes if the earth
    // radius is swapped for the equatorial 6378, which is the likely real bug.
    const d = haversineKm(...TOKYO, ...OSAKA);
    assert.ok(
        Math.abs(d - 403.058) < 0.01,
        `expected ~403.058km, got ${d}`
    );
});

test("haversineKm grows as the points separate", () => {
    const near = haversineKm(35.0, 139.0, 35.1, 139.0);
    const mid = haversineKm(35.0, 139.0, 36.0, 139.0);
    const far = haversineKm(35.0, 139.0, 40.0, 139.0);

    assert.ok(near < mid, `${near} < ${mid}`);
    assert.ok(mid < far, `${mid} < ${far}`);
});

test("findNearbySkiResorts returns the globally nearest resorts, not an arbitrary subset", () => {
    // video-import.tsx reads nearby[0] to pick a resort, so "the closest one
    // comes first" is the contract that matters. Slicing before sorting keeps
    // every other property below intact while silently returning the wrong
    // resort, so compare against the fully ranked list.
    const all = findNearbySkiResorts(...NAGANO, 30, Number.MAX_SAFE_INTEGER);
    assert.ok(all.length > 5, `fixture needs more than 5 candidates, got ${all.length}`);

    assert.deepEqual(findNearbySkiResorts(...NAGANO, 30, 5), all.slice(0, 5));
});

test("findNearbySkiResorts sorts ascending and caps at maxResults", () => {
    const results = findNearbySkiResorts(...NAGANO);

    assert.equal(results.length, 5); // default maxResults
    for (let i = 1; i < results.length; i++) {
        assert.ok(
            results[i - 1].distanceKm <= results[i].distanceKm,
            `not ascending at ${i}`
        );
    }

    assert.equal(findNearbySkiResorts(...NAGANO, 30, 2).length, 2);
});

test("findNearbySkiResorts keeps every hit inside the threshold", () => {
    const wide = findNearbySkiResorts(...NAGANO, 30, Number.MAX_SAFE_INTEGER);
    assert.ok(wide.every((r) => r.distanceKm <= 30));

    const tight = findNearbySkiResorts(...NAGANO, 5, Number.MAX_SAFE_INTEGER);
    assert.ok(tight.every((r) => r.distanceKm <= 5));
    assert.ok(tight.length < wide.length, "a tighter threshold must exclude more");
});

test("findNearbySkiResorts returns nothing far out at sea", () => {
    assert.deepEqual(findNearbySkiResorts(0, 0), []);
});

test("findNearbySkiResorts reports the distance it ranked by", () => {
    const [first] = findNearbySkiResorts(...NAGANO);

    assert.equal(typeof first.name, "string");
    assert.ok(first.name.length > 0);
    assert.equal(typeof first.distanceKm, "number");
    assert.ok(Number.isFinite(first.distanceKm));
});

// Not covered: the null-coordinate guard in findNearbySkiResorts. All 378
// entries in skiResorts.json carry both coordinates, so the branch is
// unreachable from the real data and deleting it would not fail these tests.
