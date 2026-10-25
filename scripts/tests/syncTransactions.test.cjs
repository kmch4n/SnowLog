// Guards every `.transaction(` call in src/ against an async callback.
//
// The app's driver, `drizzle-orm/expo-sqlite`, runs transactions synchronously:
// `begin`, call the callback, `commit` as soon as it returns. An async callback
// returns at its first `await`, so everything after it runs outside the
// transaction and a throw rolls nothing back. TypeScript accepts it (the
// callback's return type is generic), and the sqlite-proxy test harness awaits
// the callback, so neither tsc nor a repository test catches it. Three
// functions shipped that way before this guard existed.
//
// The rule enforced here is stricter than "not async", because two other
// shapes have the same failure and cannot be checked by reading the call site:
//
// - an expression-bodied arrow, `(tx) => tx.insert(...)`, returns a query
//   builder that nobody runs inside the transaction; whoever awaits the result
//   later runs it in autocommit;
// - a function passed by name, `db.transaction(work)`, hides whether `work` is
//   async.
//
// So the callback must be an inline, non-async arrow with a block body (or a
// plain `function`). Inside it, run each statement with `.run()` / `.all()` /
// `.get()` — a statement left as a bare builder is never executed.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const srcRoot = path.join(repoRoot, "src");

/** Blank out comments, keeping offsets (and so line numbers) intact. */
function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
        comment.replace(/[^\n]/g, " ")
    );
}

/** @returns {"sync" | "async" | "expression" | "opaque"} */
function classifyCallback(argument) {
    if (/^async\b/.test(argument)) return "async";
    if (/^function\b(?!\s*\*)/.test(argument)) return "sync";
    const arrow = argument.match(/^(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/);
    if (arrow) return argument[arrow[0].length] === "{" ? "sync" : "expression";
    return "opaque";
}

function findTransactionCalls(source) {
    const code = stripComments(source);
    const calls = [];
    for (const match of code.matchAll(/\.transaction\s*\(\s*/g)) {
        const argument = code.slice(match.index + match[0].length);
        calls.push({
            line: code.slice(0, match.index).split("\n").length,
            kind: classifyCallback(argument),
        });
    }
    return calls;
}

function listSourceFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...listSourceFiles(full));
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
    return files;
}

function scanSource() {
    const calls = [];
    for (const file of listSourceFiles(srcRoot)) {
        const relative = path.relative(repoRoot, file).split(path.sep).join("/");
        for (const call of findTransactionCalls(fs.readFileSync(file, "utf8"))) {
            calls.push({ file: relative, ...call });
        }
    }
    return calls;
}

test("the classifier tells the callback shapes apart", () => {
    const kinds = (source) => findTransactionCalls(source).map((call) => call.kind);

    assert.deepEqual(kinds("db.transaction((tx) => { tx.run(); })"), ["sync"]);
    assert.deepEqual(kinds("db.transaction(tx => {\n})"), ["sync"]);
    assert.deepEqual(kinds("db.transaction((tx: Tx) => {})"), ["sync"]);
    assert.deepEqual(kinds("db.transaction(function (tx) {})"), ["sync"]);
    assert.deepEqual(kinds("db\n    .transaction(\n        (tx) => {})"), ["sync"]);

    assert.deepEqual(kinds("db.transaction(async (tx) => {})"), ["async"]);
    assert.deepEqual(kinds("db.transaction(async tx => {})"), ["async"]);
    assert.deepEqual(kinds("db.transaction(async function (tx) {})"), ["async"]);
    assert.deepEqual(kinds("await db.transaction( async(tx) => {})"), ["async"]);

    assert.deepEqual(kinds("db.transaction((tx) => tx.insert(t).values(v))"), ["expression"]);
    assert.deepEqual(kinds("db.transaction(work)"), ["opaque"]);
    assert.deepEqual(kinds("db.transaction(function* (tx) {})"), ["opaque"]);
});

test("comments are ignored but line numbers survive", () => {
    const source = [
        "/** db.transaction(async (tx) => {}) */",
        "// db.transaction(async (tx) => {})",
        "db.transaction((tx) => {});",
    ].join("\n");
    assert.deepEqual(findTransactionCalls(source), [{ line: 3, kind: "sync" }]);
});

test("the scan reaches the repositories that open transactions", () => {
    // If the walker or the pattern breaks, the guard below passes on nothing.
    // Pin it to call sites that are known to exist.
    const files = new Set(scanSource().map((call) => call.file));
    for (const expected of [
        "src/database/repositories/tagRepository.ts",
        "src/database/repositories/techniqueOptionRepository.ts",
        "src/database/repositories/videoStorageRepository.ts",
        "src/database/repositories/videoTransferJobRepository.ts",
    ]) {
        assert.ok(files.has(expected), `no transaction found in ${expected}`);
    }
});

test("every transaction callback in src/ is synchronous and inline", () => {
    const offenders = scanSource()
        .filter((call) => call.kind !== "sync")
        .map((call) => `${call.file}:${call.line} (${call.kind})`);
    assert.deepEqual(
        offenders,
        [],
        "expo-sqlite transactions are synchronous: use an inline `(tx) => { ... }` " +
            "callback and run each statement with .run() / .all() / .get()"
    );
});
