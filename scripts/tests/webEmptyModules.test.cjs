// On Web, metro.config.js resolves some native-only packages to an empty module.
// Importing one is harmless until the importer *uses* it while being evaluated —
// and Expo Router evaluates every _layout variant, including the native one it
// will not render. That is how `openDatabaseSync()` at module scope in
// src/database/index.ts took the whole Web build down (#84).
//
// The rule enforced here: a module that imports an emptied package must have a
// `.web` companion, so the Web bundle never evaluates the native body. Routes
// count too: _layout.tsx is covered by _layout.web.tsx.
//
// It reads metro.config.js instead of restating the list, so adding a package
// to the empty-module mapping extends this check automatically.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const srcRoot = path.join(repoRoot, "src");

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
}

/** The exact names and prefixes metro.config.js maps to the empty module. */
function readEmptiedSpecifiers() {
    const config = fs.readFileSync(path.join(repoRoot, "metro.config.js"), "utf8");
    const exact = [...config.matchAll(/moduleName\s*===\s*"([^"]+)"/g)].map((m) => m[1]);
    const prefixes = [...config.matchAll(/moduleName\.startsWith\(\s*"([^"]+)"\s*\)/g)].map(
        (m) => m[1]
    );
    return { exact, prefixes };
}

function importedSpecifiers(source) {
    const specifiers = [];
    for (const m of source.matchAll(
        /^\s*(import|export)\s+(type\s+)?[^;]*?\sfrom\s+["']([^"']+)["']/gm
    )) {
        // A type-only import is erased before Metro sees it.
        if (m[2]) continue;
        specifiers.push(m[3]);
    }
    for (const m of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
        specifiers.push(m[1]);
    }
    for (const m of source.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
        specifiers.push(m[1]);
    }
    return specifiers;
}

const emptied = readEmptiedSpecifiers();

function isEmptied(specifier) {
    return (
        emptied.exact.includes(specifier) ||
        emptied.prefixes.some((prefix) => specifier.startsWith(prefix))
    );
}

// If the config is reworded so the regexes stop matching, every check below
// would pass with nothing to check.
test("the empty-module mapping is readable from metro.config.js", () => {
    assert.ok(emptied.exact.includes("expo-sqlite"), "expo-sqlite mapping not found");
    assert.ok(
        emptied.prefixes.includes("drizzle-orm/expo-sqlite"),
        "drizzle-orm/expo-sqlite prefix mapping not found"
    );
});

test("the import scan sees the known importers", () => {
    const importers = walk(srcRoot)
        .filter((file) => importedSpecifiers(fs.readFileSync(file, "utf8")).some(isEmptied))
        .map((file) => path.relative(repoRoot, file).replace(/\\/g, "/"));
    assert.ok(importers.includes("src/database/index.ts"));
    assert.ok(importers.includes("src/app/_layout.tsx"));
});

test("every importer of a Web-emptied package has a .web companion", () => {
    const offenders = [];
    for (const file of walk(srcRoot)) {
        if (/\.web\.(ts|tsx)$/.test(file)) continue;
        const hits = importedSpecifiers(fs.readFileSync(file, "utf8")).filter(isEmptied);
        if (hits.length === 0) continue;
        const companion = file.replace(/\.(ts|tsx)$/, ".web.$1");
        if (!fs.existsSync(companion)) {
            offenders.push(`${path.relative(repoRoot, file)} imports ${hits.join(", ")}`);
        }
    }
    assert.deepEqual(
        offenders,
        [],
        "these modules would run native code against an empty module on Web; add a .web companion"
    );
});

test("no .web module imports a package that is empty on Web", () => {
    const offenders = [];
    for (const file of walk(srcRoot)) {
        if (!/\.web\.(ts|tsx)$/.test(file)) continue;
        const hits = importedSpecifiers(fs.readFileSync(file, "utf8")).filter(isEmptied);
        if (hits.length > 0) {
            offenders.push(`${path.relative(repoRoot, file)} imports ${hits.join(", ")}`);
        }
    }
    assert.deepEqual(offenders, []);
});
