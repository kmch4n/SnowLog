#!/usr/bin/env node
// Web smoke test: renders every route of an exported Web build in headless
// Chrome and checks that real screen content appears.
//
// Why a browser and not a unit test: #84 bundled cleanly and died only when the
// bundle ran, because Expo Router evaluates the native _layout.tsx on Web. Only
// executing the bundle catches that class.
//
// Usage:
//   npx expo export --platform web --output-dir dist
//   node scripts/webSmoke.cjs [distDir]
// or `npm run test:web`, which does both.
//
// Markers are locale keys, not English literals, so a copy change does not break
// the smoke test. Chrome is pinned to en-US so they resolve against en.ts.

"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const distDir = path.resolve(repoRoot, process.argv[2] ?? "dist");

/** Route → locale key whose text only that screen's body renders. */
const ROUTES = [
    ["/", "home.importFab"],
    ["/dashboard", "dashboard.resortRanking"],
    ["/calendar", "calendar.switchToWeek"],
    ["/search", "search.datePresets.thisMonth"],
    ["/settings", "settings.descriptions.calendar"],
    ["/settings/techniques", "settings.techniques.title"],
    ["/settings/tags", "settings.tags.title"],
    ["/settings/favorite-resorts", "settings.favoriteResorts.title"],
    ["/settings/calendar", "settings.calendar.weekStartDay"],
    ["/settings/duplicate-candidates", "settings.duplicateCandidates.summary"],
    ["/video-import", "import.webUnsupportedTitle"],
    // mock-1 is the first video in videoRepository.web.ts.
    ["/video/mock-1", "videoDetail.webPlaybackNotice"],
];

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

function fail(message) {
    console.error(`webSmoke: ${message}`);
    process.exit(1);
}

/** Loads en.ts without a build step by transpiling it in memory. */
function loadEnglish() {
    const ts = require(path.join(repoRoot, "node_modules", "typescript"));
    const source = fs.readFileSync(path.join(repoRoot, "src/i18n/locales/en.ts"), "utf8");
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const mod = { exports: {} };
    // en.ts only imports types from ja.ts, which transpilation erases.
    new Function("module", "exports", "require", outputText)(mod, mod.exports, require);
    return mod.exports.en;
}

function lookup(table, key) {
    const value = key.split(".").reduce((node, part) => node?.[part], table);
    if (typeof value !== "string") fail(`locale key ${key} does not resolve to a string`);
    // A marker must be plain text: interpolation would never match the DOM.
    if (value.includes("{{")) fail(`locale key ${key} is interpolated; pick a literal one`);
    // Multi-line copy renders with <br>-like breaks; the first line is enough.
    return value.split("\n")[0];
}

/** Static server with the single-page-app fallback that Expo's web output needs. */
function serve(root) {
    const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".ttf": "font/ttf",
    };
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
        let file = path.join(root, urlPath);
        if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            file = path.join(root, "index.html");
        }
        res.writeHead(200, {
            "content-type": types[path.extname(file)] ?? "application/octet-stream",
        });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function dumpDom(chrome, url) {
    const args = [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--lang=en-US",
        "--virtual-time-budget=15000",
        "--dump-dom",
        url,
    ];
    return new Promise((resolve, reject) => {
        execFile(chrome, args, { timeout: 90_000, maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

function visibleText(html) {
    return html
        .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ");
}

async function main() {
    if (!fs.existsSync(path.join(distDir, "index.html"))) {
        fail(`${distDir}/index.html not found. Run: npx expo export --platform web --output-dir dist`);
    }
    const chrome = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
    if (!chrome) fail("no Chrome found; set CHROME_PATH");

    const en = loadEnglish();
    const boundaryTitle = lookup(en, "errors.boundary.title");
    const server = await serve(distDir);
    const base = `http://127.0.0.1:${server.address().port}`;

    const failures = [];
    try {
        for (const [route, key] of ROUTES) {
            const marker = lookup(en, key);
            const text = visibleText(await dumpDom(chrome, base + route));
            if (text.includes(boundaryTitle)) {
                failures.push(`${route}: the error boundary rendered`);
            } else if (!text.includes(marker)) {
                failures.push(`${route}: expected "${marker}" (${key}); page text began "${text.trim().slice(0, 120)}"`);
            } else {
                console.log(`ok ${route}`);
            }
        }
    } finally {
        server.close();
    }

    if (failures.length > 0) {
        for (const line of failures) console.error(`not ok ${line}`);
        fail(`${failures.length} of ${ROUTES.length} routes did not render`);
    }
    console.log(`webSmoke: all ${ROUTES.length} routes rendered`);
}

main().catch((error) => fail(error.stack ?? String(error)));
