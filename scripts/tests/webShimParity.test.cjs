// Compares the exported value names of every native/.web pair by reading the
// sources — no compilation, so it costs nothing and cannot be defeated by a
// module that needs expo at load time.
//
// Value exports only. Type exports are erased at runtime and every type
// consumer resolves to the native file, so a missing type export cannot cause
// the `TypeError: x is not a function` this guards against (#74). Requiring
// type parity would only force shims to re-declare types nothing reads.

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
        else out.push(full);
    }
    return out;
}

/** Native/.web pairs, as repo-relative paths. */
function findPairs() {
    const pairs = [];
    for (const full of walk(srcRoot)) {
        const match = /\.web\.(ts|tsx)$/.exec(full);
        if (!match) continue;
        const native = full.replace(/\.web\.(ts|tsx)$/, `.$1`);
        if (!fs.existsSync(native)) continue;
        pairs.push({
            native: path.relative(repoRoot, native).replace(/\\/g, "/"),
            web: path.relative(repoRoot, full).replace(/\\/g, "/"),
        });
    }
    return pairs.sort((a, b) => a.native.localeCompare(b.native));
}

/** Resolves a relative specifier the way Metro would for a native build. */
function resolveRelative(fromFile, specifier) {
    const base = path.resolve(path.dirname(fromFile), specifier);
    for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
    ]) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

/**
 * Exported value names, plus any export form this parser does not understand.
 * Unknown forms are reported rather than skipped: a parser that silently
 * ignores `export *` would pass vacuously.
 *
 * `export * from "./x"` is followed into the relative module and contributes
 * that module's value exports (minus `default`, which `export *` never
 * forwards). A bare-specifier `export *` cannot be read from source and stays
 * unsupported.
 */
function parseExports(file, seen = new Set()) {
    const absolute = path.resolve(repoRoot, file);
    const source = fs.readFileSync(absolute, "utf8");
    seen.add(absolute);
    const values = new Set();
    const unsupported = [];

    for (const m of source.matchAll(
        /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm
    )) {
        values.add(m[1]);
    }
    for (const m of source.matchAll(
        /^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/gm
    )) {
        values.add(m[1]);
    }
    for (const m of source.matchAll(/^export\s+class\s+([A-Za-z0-9_$]+)/gm)) {
        values.add(m[1]);
    }
    for (const m of source.matchAll(
        /^export\s+default\s+(?:async\s+)?(?:function|class)\s/gm
    )) {
        values.add("default");
    }
    // `export { a, b as c }` and `export { x } from "./y"`. A leading
    // `export type { … }` block is type-only and skipped entirely; an inline
    // `type` specifier inside a value block is skipped individually.
    for (const m of source.matchAll(/^export\s+(type\s+)?\{([^}]*)\}/gm)) {
        if (m[1]) continue;
        for (const raw of m[2].split(",")) {
            const part = raw.trim();
            if (!part || part.startsWith("type ")) continue;
            const asMatch = /\s+as\s+([A-Za-z0-9_$]+)$/.exec(part);
            values.add(asMatch ? asMatch[1] : part);
        }
    }

    for (const m of source.matchAll(
        /^export\s+\*(?:\s+as\s+([A-Za-z0-9_$]+))?\s+from\s+["']([^"']+)["']/gm
    )) {
        const [, namespace, specifier] = m;
        if (namespace) {
            values.add(namespace);
            continue;
        }
        const target = specifier.startsWith(".")
            ? resolveRelative(absolute, specifier)
            : null;
        if (!target) {
            unsupported.push(m[0].trim());
            continue;
        }
        if (seen.has(target)) continue;
        const nested = parseExports(target, seen);
        for (const name of nested.values) if (name !== "default") values.add(name);
        unsupported.push(...nested.unsupported);
    }
    for (const m of source.matchAll(/^export\s+\*(?![^\n]*\bfrom\s+["'])/gm)) {
        unsupported.push(m[0].trim());
    }

    return { values, unsupported };
}

const pairs = findPairs();

// Without this, a walk that matches nothing turns every assertion below into a
// vacuous pass.
test("the pair scan finds the shims that exist", () => {
    assert.ok(
        pairs.length >= 15,
        `expected at least 15 native/.web pairs, found ${pairs.length}`
    );
    const natives = pairs.map((pair) => pair.native);
    assert.ok(natives.includes("src/services/mediaService.ts"));
    assert.ok(natives.includes("src/database/repositories/videoRepository.ts"));
    assert.ok(natives.includes("src/components/ui/GlassSurface.tsx"));
});

// Guards the parser itself. `mediaService.web.ts` exposes isSyntheticAssetId
// through `export { … } from`, the one form a naive regex misses — and the
// form whose absence was Issue #71.
//
// This guard is not redundant with the parity test below: break the
// `export {` branch and the parity test stays green, because mediaService's
// native and shim both use that form and both silently lose the same name, so
// the difference still nets to empty. Only this test catches it.
test("the parser understands re-export and plain function forms", () => {
    const { values } = parseExports("src/services/mediaService.web.ts");
    assert.ok(
        values.has("isSyntheticAssetId"),
        "re-export form not parsed; every parity check below would under-report"
    );
    assert.ok(values.has("checkAssetExists"), "plain function form not parsed");
});

// Guards the `export *` branch the same way. Both database entry points re-export
// the schema with it, so dropping the branch would empty both sides equally and
// leave the parity test green while a shim silently lost every table.
test("the parser follows a relative export-star into its target", () => {
    const { values, unsupported } = parseExports("src/database/index.ts");
    assert.deepEqual(unsupported, []);
    assert.ok(values.has("db"), "local export lost while following export-star");
    assert.ok(values.has("videos"), "schema table not reached through export-star");
    assert.ok(values.has("diaryEntries"), "export-star stopped short of the last table");
});

test("no source uses an export form the parser cannot read", () => {
    const offenders = [];
    for (const pair of pairs) {
        for (const file of [pair.native, pair.web]) {
            const { unsupported } = parseExports(file);
            for (const form of unsupported) offenders.push(`${file}: ${form}`);
        }
    }
    assert.deepEqual(
        offenders,
        [],
        "extend parseExports before using these forms in a shimmed module"
    );
});

test("every .web shim exports at least what its native module does", () => {
    const gaps = [];
    for (const pair of pairs) {
        const native = parseExports(pair.native).values;
        const web = parseExports(pair.web).values;
        const missing = [...native].filter((name) => !web.has(name)).sort();
        if (missing.length > 0) gaps.push(`${pair.web} is missing ${missing.join(", ")}`);
    }
    assert.deepEqual(gaps, []);
});
