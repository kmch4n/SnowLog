// Dashboard aggregation, extracted from dashboardRepository so the Web mock
// can run the same code. These pin the behaviour the native screen already had.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-dashboard-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/dashboardStats.ts",
        "--outDir", outDir,
        "--rootDir", "src",
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const { buildDashboardStats } = require(path.join(outDir, "utils", "dashboardStats.js"));
const { buildSeason, toDateKey } = require(path.join(outDir, "utils", "dateUtils.js"));

const season = buildSeason(2025); // Nov 2025 – May 2026

function at(year, month, day, hour = 10) {
    return Math.floor(new Date(year, month - 1, day, hour).getTime() / 1000);
}

function row(id, capturedAt, overrides = {}) {
    return {
        id,
        capturedAt,
        duration: 30,
        skiResortName: "Hakuba",
        isFavorite: 0,
        techniques: null,
        ...overrides,
    };
}

const rows = [
    row("a", at(2026, 1, 10, 9), { techniques: '["大回り","コブ"]', isFavorite: 1 }),
    row("b", at(2026, 1, 10, 14), { techniques: '["大回り"]', duration: 60 }),
    row("c", at(2026, 2, 3), { skiResortName: "Zao" }),
    row("d", at(2026, 2, 4), { skiResortName: "Zao" }),
    row("e", at(2025, 12, 20), { skiResortName: null, techniques: "not json" }),
];

test("the summary counts days, videos, duration, resorts and favourites", () => {
    const { summary } = buildDashboardStats(season, rows, []);
    assert.deepEqual(summary, {
        totalSkiDays: 4, // two videos share 2026-01-10
        totalVideoCount: 5,
        totalDurationSeconds: 30 * 4 + 60,
        uniqueResortCount: 2, // a null resort is not a resort
        favoriteCount: 1,
    });
});

test("resorts rank by visit days, then by video count", () => {
    const { resortRanking } = buildDashboardStats(season, rows, []);
    assert.deepEqual(
        resortRanking.map((r) => [r.skiResortName, r.visitDays, r.videoCount]),
        [
            ["Zao", 2, 2],
            ["Hakuba", 1, 2],
        ]
    );
    assert.equal(resortRanking[1].lastVisitTimestamp, at(2026, 1, 10, 14));
});

test("techniques are counted from the JSON column; malformed JSON counts nothing", () => {
    const { techniqueDistribution } = buildDashboardStats(season, rows, []);
    assert.deepEqual(techniqueDistribution, [
        { name: "大回り", count: 2 },
        { name: "コブ", count: 1 },
    ]);
});

test("the monthly trend always has the season's seven months, empty ones included", () => {
    const { monthlyTrend } = buildDashboardStats(season, rows, []);
    assert.deepEqual(
        monthlyTrend.map((m) => [m.yearMonth, m.videoCount, m.skiDays]),
        [
            ["2025-11", 0, 0],
            ["2025-12", 1, 1],
            ["2026-01", 2, 1],
            ["2026-02", 2, 2],
            ["2026-03", 0, 0],
            ["2026-04", 0, 0],
            ["2026-05", 0, 0],
        ]
    );
    assert.equal(monthlyTrend[2].label, "1月");
});

test("heatmap days are per local date and sorted", () => {
    const { heatmapDays } = buildDashboardStats(season, rows, []);
    assert.deepEqual(heatmapDays, [
        { dateKey: toDateKey(at(2025, 12, 20)), count: 1 },
        { dateKey: toDateKey(at(2026, 1, 10)), count: 2 },
        { dateKey: toDateKey(at(2026, 2, 3)), count: 1 },
        { dateKey: toDateKey(at(2026, 2, 4)), count: 1 },
    ]);
});

test("recent videos get parsed techniques, a valid storage mode and no tags yet", () => {
    const recent = {
        ...row("a", at(2026, 1, 10)),
        assetId: "x",
        filename: "a.mov",
        thumbnailUri: "",
        memo: "",
        title: null,
        techniques: '["大回り"]',
        isFileAvailable: 1,
        storageMode: "bogus",
        managedVideoPath: null,
        createdAt: 1,
        updatedAt: 1,
    };
    const { recentVideos } = buildDashboardStats(season, rows, [recent]);
    assert.deepEqual(recentVideos[0].techniques, ["大回り"]);
    assert.equal(recentVideos[0].storageMode, "reference");
    assert.deepEqual(recentVideos[0].tags, []);
});
