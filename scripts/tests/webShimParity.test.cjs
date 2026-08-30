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

/**
 * Exported value names, plus any export form this parser does not understand.
 * Unknown forms are reported rather than skipped: a parser that silently
 * ignores `export *` would pass vacuously.
 */
function parseExports(source) {
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

    for (const m of source.matchAll(/^export\s+\*/gm)) {
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
    const shim = fs.readFileSync(
        path.join(repoRoot, "src/services/mediaService.web.ts"),
        "utf8"
    );
    const { values } = parseExports(shim);
    assert.ok(
        values.has("isSyntheticAssetId"),
        "re-export form not parsed; every parity check below would under-report"
    );
    assert.ok(values.has("checkAssetExists"), "plain function form not parsed");
});

test("no source uses an export form the parser cannot read", () => {
    const offenders = [];
    for (const pair of pairs) {
        for (const file of [pair.native, pair.web]) {
            const { unsupported } = parseExports(
                fs.readFileSync(path.join(repoRoot, file), "utf8")
            );
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
        const native = parseExports(
            fs.readFileSync(path.join(repoRoot, pair.native), "utf8")
        ).values;
        const web = parseExports(
            fs.readFileSync(path.join(repoRoot, pair.web), "utf8")
        ).values;
        const missing = [...native].filter((name) => !web.has(name)).sort();
        if (missing.length > 0) gaps.push(`${pair.web} is missing ${missing.join(", ")}`);
    }
    assert.deepEqual(gaps, []);
});
