// getWeekDates / getWeekDateRange build local midnights and read them back as
// Unix seconds, so their output depends on the machine timezone. The assertions
// below derive their expectations the same way, so they hold in any fixed zone;
// the pin instead keeps a zone with DST from making a "week" 23 or 25 hours long
// and keeps any future absolute-epoch assertion honest. It must run before the
// first Date is constructed.
process.env.TZ = "Asia/Tokyo";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-calendar-utils-"));
const outDir = path.join(tmpRoot, "out");
const tsconfigPath = path.join(tmpRoot, "tsconfig.json");
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

// calendarUtils.ts type-imports "@/types" and "@/i18n/types". A bare
// `tsc <file>` has no path mapping, fails those with TS2307, and exits
// non-zero, so hand it the one mapping it needs. The project tsconfig cannot be
// extended here: it inherits moduleResolution "bundler" from expo/tsconfig.base,
// which rejects module "commonjs". Paths must be absolute because relative ones
// would resolve against this temp directory.
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
            baseUrl: repoRoot,
            paths: { "@/*": [path.join(repoRoot, "src", "*")] },
            types: [],
        },
        files: [path.join(repoRoot, "src", "utils", "calendarUtils.ts")],
    })
);

execFileSync(process.execPath, [tscBin, "--project", tsconfigPath], {
    cwd: repoRoot,
    stdio: "inherit",
});

process.on("exit", () => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test.after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// Resolving the type imports pulls src/types and src/i18n into the program, so
// tsc roots the output at src/ and nests the emit under utils/.
const {
    getDayLabels,
    getMonthOffset,
    getWeekDates,
    getWeekDateRange,
    getWeekNumber,
    getWeekOffsetForDate,
    isSaturdayColumn,
    isSundayColumn,
} = require(path.join(outDir, "utils", "calendarUtils.js"));

function toKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

test("getDayLabels orders the week from the configured start day", () => {
    assert.deepEqual(getDayLabels("monday"), ["月", "火", "水", "木", "金", "土", "日"]);
    assert.deepEqual(getDayLabels("sunday"), ["日", "月", "火", "水", "木", "金", "土"]);
    assert.deepEqual(getDayLabels("monday", "en"), [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
    ]);
    assert.equal(getDayLabels("sunday", "en")[0], "Sun");
});

test("getMonthOffset counts the blank cells before the first of the month", () => {
    // 2026-01-01 is a Thursday.
    assert.equal(getMonthOffset(2026, 1, "monday"), 3);
    assert.equal(getMonthOffset(2026, 1, "sunday"), 4);
});

test("getMonthOffset wraps Sunday to the end of a Monday-start week", () => {
    // 2026-02-01 is a Sunday: last column on a Monday start, first on a Sunday start.
    assert.equal(getMonthOffset(2026, 2, "monday"), 6);
    assert.equal(getMonthOffset(2026, 2, "sunday"), 0);
});

test("getWeekDates returns seven consecutive days from the week start", () => {
    // 2026-02-25 is a Wednesday.
    const week = getWeekDates(new Date(2026, 1, 25), 0, "monday");
    assert.equal(week.length, 7);
    assert.equal(toKey(week[0]), "2026-02-23"); // Monday
    assert.equal(toKey(week[6]), "2026-03-01"); // Sunday, crossing into March
});

test("getWeekDates shifts whole weeks by the offset", () => {
    const prev = getWeekDates(new Date(2026, 1, 25), -1, "monday");
    const next = getWeekDates(new Date(2026, 1, 25), 1, "monday");
    assert.equal(toKey(prev[0]), "2026-02-16");
    assert.equal(toKey(next[0]), "2026-03-02");
});

test("getWeekDates honours a Sunday week start", () => {
    const week = getWeekDates(new Date(2026, 1, 25), 0, "sunday");
    assert.equal(toKey(week[0]), "2026-02-22");
    assert.equal(toKey(week[6]), "2026-02-28");
});

test("getWeekDateRange spans local midnight to the last second of the week", () => {
    const week = getWeekDates(new Date(2026, 1, 25), 0, "monday");
    const { dateFrom, dateTo } = getWeekDateRange(week);

    assert.equal(
        dateFrom,
        Math.floor(new Date(2026, 1, 23, 0, 0, 0, 0).getTime() / 1000)
    );
    assert.equal(
        dateTo,
        Math.floor(new Date(2026, 2, 1, 23, 59, 59, 999).getTime() / 1000)
    );
    assert.equal(dateTo - dateFrom, 7 * 24 * 60 * 60 - 1);
});

test("getWeekNumber reports the 1-based week of the month", () => {
    // 2026-02-01 is a Sunday, so a Monday-start month opens with a 6-cell offset.
    assert.equal(getWeekNumber(new Date(2026, 1, 1), "monday"), 1);
    assert.equal(getWeekNumber(new Date(2026, 1, 2), "monday"), 2);
    // February 2026 starts on a Sunday, so a Sunday-start month divides evenly:
    // the 28th closes the fourth week.
    assert.equal(getWeekNumber(new Date(2026, 1, 1), "sunday"), 1);
    assert.equal(getWeekNumber(new Date(2026, 1, 28), "sunday"), 4);
    assert.equal(getWeekNumber(new Date(2026, 1, 22), "sunday"), 4);
});

test("getWeekOffsetForDate counts whole weeks between the two dates' weeks", () => {
    // 2026-02-25 is a Wednesday; its Monday-start week is 02-23..03-01.
    const ref = new Date(2026, 1, 25);
    assert.equal(getWeekOffsetForDate(ref, new Date(2026, 1, 23), "monday"), 0); // same week Monday
    assert.equal(getWeekOffsetForDate(ref, new Date(2026, 2, 1), "monday"), 0); // same week Sunday
    assert.equal(getWeekOffsetForDate(ref, new Date(2026, 2, 2), "monday"), 1); // next Monday
    assert.equal(getWeekOffsetForDate(ref, new Date(2026, 1, 22), "monday"), -1); // previous Sunday
    assert.equal(getWeekOffsetForDate(ref, new Date(2026, 3, 1), "monday"), 5); // 2026-04-01 (week of 03-30)
});

test("getWeekOffsetForDate round-trips through getWeekDates", () => {
    const ref = new Date(2026, 6, 19);
    const target = new Date(2026, 11, 31);
    for (const weekStartDay of ["monday", "sunday"]) {
        const offset = getWeekOffsetForDate(ref, target, weekStartDay);
        const week = getWeekDates(ref, offset, weekStartDay);
        assert.ok(
            week.some((d) => toKey(d) === toKey(target)),
            `week at offset ${offset} (${weekStartDay}) should contain ${toKey(target)}`
        );
    }
});

test("weekend column checks follow the configured week start", () => {
    assert.equal(isSaturdayColumn(5, "monday"), true);
    assert.equal(isSaturdayColumn(6, "monday"), false);
    assert.equal(isSaturdayColumn(6, "sunday"), true);

    assert.equal(isSundayColumn(6, "monday"), true);
    assert.equal(isSundayColumn(0, "monday"), false);
    assert.equal(isSundayColumn(0, "sunday"), true);
});
