// Guards the i18n key set in both directions (#83):
//
//   (a) every key `src/` names literally exists in `ja.ts` — a deleted-but-used
//       key would otherwise render as raw key text at runtime, and nothing but
//       a device walk would notice;
//   (b) every key in `ja.ts` is reached from `src/`, except an explicit
//       allowlist — so strings stop outliving the UI that used them.
//
// `en.ts` is not read: `Translations = typeof ja` makes `tsc` enforce parity.
//
// The scan walks the TypeScript AST of every `.ts`/`.tsx` under `src/`
// (outside `i18n/locales/`) and treats a key as live when it is:
//   - a string literal anywhere that equals a key path (covers `t("…")` and
//     keys held in constants, e.g. `labelKey: "settings.calendar.monday"`);
//   - under the literal head of a template literal passed to `t()`, e.g.
//     `` t(`diary.weather.${x}`) `` keeps all of `diary.weather.*`.
//
// The trap (see #83): `DiaryOptionChips` calls `` t(`${labelPrefix}.${v}`) ``,
// whose literal head is empty. Treating "" as a prefix marks every key live and
// makes (b) pass vacuously. An empty head is therefore never used as a prefix;
// it must name a prop whose string values are collected from JSX call sites
// (`labelPrefix="diary.weather"`), and the scan fails if it cannot.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..", "..");
const srcRoot = path.join(repoRoot, "src");
const localesDir = path.join(srcRoot, "i18n", "locales");

/**
 * Keys that are unreferenced on purpose. Each entry needs a reason.
 *
 * The `common.*` block may be a deliberately stocked shared vocabulary; whether
 * to keep or delete it is pending the maintainer's decision in #83.
 */
const UNREFERENCED_ALLOWLIST = new Set([
    "common.save",
    "common.edit",
    "common.close",
    "common.error",
]);

/**
 * Non-literal `t()` arguments the scan knows how to account for, as
 * `<repo-relative file>: <argument source>`. Each one must be fed only by key
 * literals elsewhere in `src/`, which the literal scan already counts as live.
 * A new indirection fails the scan until it is reviewed and listed here.
 */
const KNOWN_INDIRECT_ARGUMENTS = new Set([
    // OPTIONS[].labelKey holds "settings.calendar.monday" / ".sunday".
    "src/app/settings/calendar.tsx: opt.labelKey",
]);

function loadJa() {
    const file = path.join(localesDir, "ja.ts");
    const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
        },
        fileName: file,
    });
    const module = { exports: {} };
    new Function("module", "exports", "require", outputText)(
        module,
        module.exports,
        require
    );
    return module.exports.ja;
}

function flatten(value, prefix, leaves, branches) {
    if (value !== null && typeof value === "object") {
        if (prefix) branches.add(prefix);
        for (const [key, child] of Object.entries(value)) {
            flatten(child, prefix ? `${prefix}.${key}` : key, leaves, branches);
        }
    } else {
        leaves.add(prefix);
    }
}

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (full !== localesDir) out.push(...walk(full));
        } else if (/\.tsx?$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

function isTCall(node) {
    return (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t" &&
        node.arguments.length > 0
    );
}

/**
 * Scans `files` and returns what it found. `jsxPropValues` is collected from
 * every file before empty-head templates are resolved, because the prop's
 * values live at call sites in other files.
 */
function scanSources(files) {
    const literals = new Set();
    const templatePrefixes = new Set();
    const emptyHeadProps = [];
    const indirectArguments = [];
    const jsxPropValues = new Map();

    for (const file of files) {
        const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
        const source = ts.createSourceFile(
            file,
            fs.readFileSync(file, "utf8"),
            ts.ScriptTarget.Latest,
            true,
            file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );

        const visit = (node) => {
            if (
                ts.isStringLiteral(node) ||
                ts.isNoSubstitutionTemplateLiteral(node)
            ) {
                literals.add(node.text);
            }

            if (
                ts.isJsxAttribute(node) &&
                node.initializer &&
                ts.isStringLiteral(node.initializer)
            ) {
                const name = node.name.getText(source);
                if (!jsxPropValues.has(name)) jsxPropValues.set(name, new Set());
                jsxPropValues.get(name).add(node.initializer.text);
            }

            if (isTCall(node)) {
                visitTArgument(node.arguments[0]);
            }

            ts.forEachChild(node, visit);
        };
        const visitTArgument = (arg) => {
            if (ts.isParenthesizedExpression(arg)) {
                visitTArgument(arg.expression);
            } else if (ts.isConditionalExpression(arg)) {
                // `t(cond ? "a.b" : "a.c")` — each branch is its own argument.
                visitTArgument(arg.whenTrue);
                visitTArgument(arg.whenFalse);
            } else if (ts.isTemplateExpression(arg)) {
                if (arg.head.text !== "") {
                    templatePrefixes.add(arg.head.text);
                } else {
                    const first = arg.templateSpans[0];
                    emptyHeadProps.push({
                        where: `${rel}: ${arg.getText(source)}`,
                        prop: ts.isIdentifier(first.expression)
                            ? first.expression.text
                            : null,
                        // Literal text between the substitution and the
                        // next one, e.g. "." in `${labelPrefix}.${v}`.
                        separator: first.literal.text,
                    });
                }
            } else if (
                !ts.isStringLiteral(arg) &&
                !ts.isNoSubstitutionTemplateLiteral(arg)
            ) {
                indirectArguments.push(`${rel}: ${arg.getText(source)}`);
            }
        };
        visit(source);
    }

    const unresolved = [];
    const resolvedPropPrefixes = new Set();
    for (const site of emptyHeadProps) {
        const values = site.prop ? jsxPropValues.get(site.prop) : undefined;
        if (!values || values.size === 0 || [...values].some((v) => v === "")) {
            unresolved.push(site.where);
            continue;
        }
        for (const value of values) {
            resolvedPropPrefixes.add(`${value}${site.separator}`);
        }
    }

    return {
        literals,
        templatePrefixes,
        resolvedPropPrefixes,
        unresolved,
        indirectArguments,
    };
}

const ja = loadJa();
const leaves = new Set();
const branches = new Set();
flatten(ja, "", leaves, branches);
const namespaces = new Set(Object.keys(ja));
const scan = scanSources(walk(srcRoot));
const allPrefixes = new Set([
    ...scan.templatePrefixes,
    ...scan.resolvedPropPrefixes,
]);

/** Literals shaped like a key under one of `ja`'s top-level namespaces. */
function keyLikeLiterals() {
    return [...scan.literals].filter((text) => {
        if (!/^[A-Za-z]\w*(\.\w+)+$/.test(text)) return false;
        return namespaces.has(text.split(".")[0]);
    });
}

function isLive(key) {
    if (scan.literals.has(key)) return true;
    // A literal naming a branch does not keep its children live: the only
    // branch literals are `labelPrefix` values, and letting them count here
    // would bypass the prefix resolution this test exists to check.
    for (const prefix of allPrefixes) {
        if (prefix !== "" && key.startsWith(prefix)) return true;
    }
    return false;
}

test("the scanner is not vacuous", () => {
    assert.ok(leaves.size > 300, `only ${leaves.size} leaf keys in ja.ts`);
    assert.ok(
        keyLikeLiterals().length > 300,
        `only ${keyLikeLiterals().length} key-like literals found in src/`
    );

    // One spot check per path a key can take to be counted as live.
    assert.ok(scan.literals.has("common.cancel"), "plain t() literal");
    assert.ok(
        scan.literals.has("settings.calendar.monday"),
        "key held in a constant"
    );

    assert.deepEqual([...scan.templatePrefixes].sort(), [
        "diary.snow.",
        "diary.weather.",
        "import.bulk.steps.",
        "search.datePresets.",
        "settings.duplicateCandidates.reasons.",
        "settings.import.errors.",
    ]);
    assert.deepEqual([...scan.resolvedPropPrefixes].sort(), [
        "diary.fatigue.",
        "diary.snow.",
        "diary.weather.",
    ]);
    for (const prefix of allPrefixes) {
        assert.notEqual(prefix, "", "an empty prefix would mark every key live");
    }
});

test("every dynamic t() key resolves to a known prefix", () => {
    assert.deepEqual(
        scan.unresolved,
        [],
        "t() template with an empty literal head whose prop has no string " +
            "values at any JSX call site; resolve it or the scan proves nothing"
    );
    for (const prefix of allPrefixes) {
        assert.ok(
            [...leaves].some((key) => key.startsWith(prefix)),
            `dynamic prefix "${prefix}" matches no key in ja.ts`
        );
    }
    assert.deepEqual(
        scan.indirectArguments.filter((arg) => !KNOWN_INDIRECT_ARGUMENTS.has(arg)),
        [],
        "unreviewed non-literal t() argument; check where its keys come from " +
            "and add it to KNOWN_INDIRECT_ARGUMENTS"
    );
    for (const known of KNOWN_INDIRECT_ARGUMENTS) {
        assert.ok(
            scan.indirectArguments.includes(known),
            `stale KNOWN_INDIRECT_ARGUMENTS entry: ${known}`
        );
    }
});

test("every key referenced in src/ exists in ja.ts", () => {
    const missing = keyLikeLiterals().filter(
        (text) => !leaves.has(text) && !branches.has(text)
    );
    assert.deepEqual(missing.sort(), [], "keys used in src/ but absent from ja.ts");
});

test("every key in ja.ts is referenced from src/", () => {
    const unreferenced = [...leaves].filter(
        (key) => !isLive(key) && !UNREFERENCED_ALLOWLIST.has(key)
    );
    assert.deepEqual(
        unreferenced.sort(),
        [],
        "keys in ja.ts that nothing in src/ reaches; delete them from ja.ts " +
            "and en.ts, or allowlist them with a reason"
    );
    for (const key of UNREFERENCED_ALLOWLIST) {
        assert.ok(leaves.has(key), `allowlisted key no longer exists: ${key}`);
        assert.ok(!isLive(key), `allowlisted key is now referenced: ${key}`);
    }
});
