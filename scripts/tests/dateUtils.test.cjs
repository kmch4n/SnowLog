// parseExifDateTime, toDateKey and the month helpers all go through local-time
// Date construction, so their output depends on the machine timezone. Pin it
// before the first Date is constructed so the absolute values asserted below
// hold on any machine, not just a JST one.
process.env.TZ = "Asia/Tokyo";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-date-utils-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/utils/dateUtils.ts",
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

// dateUtils type-imports ../types/dashboard and ../i18n/types, which roots the
// emit at src/ and nests it under utils/.
const {
    parseExifDateTime,
    formatDate,
    formatDateShort,
    formatDateTime,
    formatDurationDecimal,
    formatDuration,
    formatDurationLabel,
    toDateKey,
    startOfMonth,
    endOfMonth,
    buildSeason,
    formatDurationHM,
} = require(path.join(outDir, "utils", "dateUtils.js"));

// --- Pure string math: no timezone, no Intl ---

test("formatDuration renders mm:ss with a zero-padded seconds field", () => {
    assert.equal(formatDuration(185), "3:05");
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(59), "0:59");
    assert.equal(formatDuration(60), "1:00");
    assert.equal(formatDuration(600), "10:00");
});

test("formatDurationLabel drops the minute part below a minute", () => {
    assert.equal(formatDurationLabel(19), "19秒");
    assert.equal(formatDurationLabel(79), "1分19秒");
    assert.equal(formatDurationLabel(60), "1分0秒");
    assert.equal(formatDurationLabel(19, "en"), "19s");
    assert.equal(formatDurationLabel(79, "en"), "1m 19s");
});

test("formatDurationLabel rounds and clamps negatives to zero", () => {
    assert.equal(formatDurationLabel(19.4), "19秒");
    assert.equal(formatDurationLabel(19.6), "20秒");
    assert.equal(formatDurationLabel(-5), "0秒");
});

test("formatDurationDecimal keeps one decimal place on the seconds", () => {
    assert.equal(formatDurationDecimal(72.483), "1分12.5秒");
    assert.equal(formatDurationDecimal(9.04), "9.0秒");
    assert.equal(formatDurationDecimal(72.483, "en"), "1m 12.5s");
    assert.equal(formatDurationDecimal(9.04, "en"), "9.0s");
});

test("formatDurationHM omits the hour part under an hour", () => {
    assert.equal(formatDurationHM(12240), "3時間24分");
    assert.equal(formatDurationHM(300), "5分");
    assert.equal(formatDurationHM(0), "0分");
    assert.equal(formatDurationHM(12240, "en"), "3 hr 24 min");
    assert.equal(formatDurationHM(300, "en"), "5 min");
});

// --- EXIF parsing ---

test("parseExifDateTime converts an EXIF timestamp to epoch milliseconds", () => {
    assert.equal(
        parseExifDateTime("2026:03:31 13:42:10"),
        new Date(2026, 2, 31, 13, 42, 10).getTime()
    );
});

test("parseExifDateTime returns null for anything off-format", () => {
    assert.equal(parseExifDateTime(""), null);
    assert.equal(parseExifDateTime("2026-03-31 13:42:10"), null); // ISO dashes
    assert.equal(parseExifDateTime("2026:03:31T13:42:10"), null); // no space
    assert.equal(parseExifDateTime("2026:03:31 13:42"), null); // no seconds
    assert.equal(parseExifDateTime("26:03:31 13:42:10"), null); // 2-digit year
    assert.equal(parseExifDateTime("not a date"), null);
});

test("parseExifDateTime rejects a well-formed but impossible date", () => {
    assert.equal(parseExifDateTime("2026:13:31 13:42:10"), null); // month 13
});

// --- Local-time date keys and month boundaries ---

test("toDateKey formats a timestamp as a zero-padded local date key", () => {
    const ts = Math.floor(new Date(2026, 0, 5, 9, 30, 0).getTime() / 1000);
    assert.equal(toDateKey(ts), "2026-01-05");
});

test("toDateKey resolves against local time, not UTC", () => {
    // 23:30 JST stays on the same local day even though it is already the next
    // day in UTC.
    const ts = Math.floor(new Date(2026, 0, 5, 23, 30, 0).getTime() / 1000);
    assert.equal(toDateKey(ts), "2026-01-05");
});

test("startOfMonth and endOfMonth bracket the whole month", () => {
    assert.equal(
        startOfMonth(2026, 2),
        Math.floor(new Date(2026, 1, 1, 0, 0, 0, 0).getTime() / 1000)
    );
    assert.equal(
        endOfMonth(2026, 2),
        Math.floor(new Date(2026, 1, 28, 23, 59, 59, 999).getTime() / 1000)
    );
    assert.equal(toDateKey(startOfMonth(2026, 2)), "2026-02-01");
    assert.equal(toDateKey(endOfMonth(2026, 2)), "2026-02-28");
});

test("endOfMonth handles leap years and 31-day months", () => {
    assert.equal(toDateKey(endOfMonth(2024, 2)), "2024-02-29");
    assert.equal(toDateKey(endOfMonth(2026, 1)), "2026-01-31");
    assert.equal(toDateKey(endOfMonth(2026, 12)), "2026-12-31");
});

test("buildSeason spans November through the following May", () => {
    const season = buildSeason(2025);

    assert.equal(season.label, "2025-26");
    assert.equal(season.startYear, 2025);
    assert.equal(season.endYear, 2026);
    assert.equal(toDateKey(season.dateFrom), "2025-11-01");
    assert.equal(toDateKey(season.dateTo), "2026-05-31");
});

// --- Intl-backed formatting ---
// Exact glyphs come from ICU and shift between Node releases, so assert only the
// locale branch and the value the timestamp carries, never the full string.

test("formatDate switches script by locale and keeps the year", () => {
    const ts = Math.floor(new Date(2025, 0, 1, 12, 0, 0).getTime() / 1000);

    const ja = formatDate(ts);
    assert.match(ja, /2025/);
    assert.match(ja, /年/);

    const en = formatDate(ts, "en");
    assert.match(en, /2025/);
    assert.match(en, /[A-Za-z]/);
    assert.doesNotMatch(en, /年/);
});

test("formatDateShort renders a numeric date in both locales", () => {
    const ts = Math.floor(new Date(2025, 0, 1, 12, 0, 0).getTime() / 1000);

    assert.match(formatDateShort(ts), /2025/);
    assert.match(formatDateShort(ts, "en"), /2025/);
});

test("formatDateTime carries the time of day alongside the date", () => {
    const ts = Math.floor(new Date(2025, 0, 1, 14, 30, 0).getTime() / 1000);

    const ja = formatDateTime(ts);
    assert.match(ja, /2025/);
    assert.match(ja, /30/); // the minutes survive

    assert.match(formatDateTime(ts, "en"), /[A-Za-z]/);
});

test("date formatters read the timestamp as seconds, not milliseconds", () => {
    // A seconds/ms mix-up would land in 1970.
    const ts = Math.floor(new Date(2025, 5, 15, 12, 0, 0).getTime() / 1000);

    assert.match(formatDate(ts), /2025/);
    assert.doesNotMatch(formatDate(ts), /1970/);
});
