/**
 * Runs repository modules against a real SQLite database.
 *
 * The other tests in this directory compile a pure `.ts` and call it. Repository
 * modules cannot be tested that way: they import `db` from `src/database/index.ts`,
 * which opens `expo-sqlite` at module load and has no node equivalent. So the
 * queries themselves — joins, ordering, round-trip counts — were unverifiable,
 * and a bug in `getTagsForVideos` shipped because of it (`6aecfbe`).
 *
 * The recipe:
 *
 * 1. `tsc` the target repositories with `--rootDir src`, so the emit lands at a
 *    predictable `<out>/database/...` no matter what each entry point imports.
 * 2. Rewrite bare `require()` specifiers in the emit to absolute paths (below).
 * 3. Replay every migration in `drizzle/` into an in-memory `node:sqlite`
 *    database, so the schema under test is the shipped one rather than a
 *    hand-written copy that can drift.
 * 4. Overwrite the emitted `database/index.js` with a drizzle instance that runs
 *    the SQL through `node:sqlite` and records it. Which driver depends on the
 *    `driver` option (below).
 *
 * Everything above `index.js` is the real shipped code.
 *
 * Two drivers, and why the choice matters:
 *
 * - `"sqlite-proxy"` (the default) records every query with its method, which
 *   is what the round-trip-count assertions in `tagRepository.test.cjs` rely on.
 *   But its `transaction()` *awaits* the callback, so an `async (tx) => {...}`
 *   callback really is atomic here.
 * - `"expo-sqlite"` runs the driver the app ships, `drizzle-orm/expo-sqlite`,
 *   over a fake expo-sqlite client backed by `node:sqlite`. That driver is
 *   synchronous: it runs `begin`, calls the callback, and runs `commit` as soon
 *   as the callback returns. An async callback returns at its first `await`, so
 *   the rest of its statements run after COMMIT, in autocommit, and a throw
 *   rolls nothing back. **Any test that claims atomicity must use this mode** —
 *   under the proxy, a broken transaction passes.
 *
 * Three constraints worth knowing before extending this:
 *
 * - **Bare specifiers are rewritten, not resolved.** The emitted repositories
 *   `require("drizzle-orm")`, which Node resolves by walking up from the file.
 *   From `os.tmpdir()` that walk never reaches this repo. Emitting inside the
 *   repo instead would work, but this checkout lives in a OneDrive-synced folder
 *   where `fs.rmSync` fails silently — it returns without error and leaves the
 *   directory behind, so every run would leak a copy of the emit. Rewriting the
 *   specifiers keeps the emit outside the synced tree and cleanup reliable.
 * - **`--rootDir src` is load-bearing.** Without it tsc infers the common root of
 *   whatever the entry points import: `tagRepository` reaches `src/types` and
 *   emits under `<out>/database/`, while `appPreferenceRepository` does not and
 *   emits at `<out>/`. Same recipe, different paths.
 * - **`setReturnArrays(true)` is required.** sqlite-proxy expects positional row
 *   arrays. Mapping `Object.values()` over the object form looks equivalent but
 *   silently collapses duplicate column names, which a join can easily produce.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const repoRoot = path.resolve(__dirname, "..", "..", "..");

let harnessCount = 0;

function compile(entryPoints, outDir) {
    execFileSync(
        process.execPath,
        [
            path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
            ...entryPoints,
            "--outDir", outDir,
            "--rootDir", "src",
            "--target", "ES2020",
            "--module", "commonjs",
            "--esModuleInterop",
            "--skipLibCheck",
        ],
        { cwd: repoRoot, stdio: "inherit" }
    );
}

/** Point every bare `require()` in the emit at this repo's node_modules. */
function absolutiseBareRequires(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            absolutiseBareRequires(full);
            continue;
        }
        if (!entry.name.endsWith(".js")) continue;

        const source = fs.readFileSync(full, "utf8");
        const rewritten = source.replace(
            /require\("([^"]+)"\)/g,
            (match, specifier) => {
                if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
                    return match;
                }
                return `require(${JSON.stringify(
                    require.resolve(specifier, { paths: [repoRoot] })
                )})`;
            }
        );
        if (rewritten !== source) fs.writeFileSync(full, rewritten);
    }
}

/**
 * Replay `drizzle/` into `sqlite`, from `startIndex` up to but not including
 * `endIndex`, and return the number now applied.
 *
 * The range exists so a test can stand up the schema as it was *before* a
 * migration and exercise a real data backfill against it. Creating the rows
 * after every migration has run tests a different thing: the backfill would
 * see columns that did not exist when the rows were written (Issue #86 §5).
 */
function applyMigrations(sqlite, startIndex = 0, endIndex = Infinity) {
    const migrationsDir = path.join(repoRoot, "drizzle");
    const journal = JSON.parse(
        fs.readFileSync(path.join(migrationsDir, "meta", "_journal.json"), "utf8")
    );
    const last = Math.min(journal.entries.length, endIndex);
    for (let index = startIndex; index < last; index += 1) {
        const sql = fs.readFileSync(
            path.join(migrationsDir, `${journal.entries[index].tag}.sql`),
            "utf8"
        );
        for (const statement of sql.split("--> statement-breakpoint")) {
            const trimmed = statement.trim();
            if (trimmed) sqlite.exec(trimmed);
        }
    }
    return last;
}

/**
 * The subset of expo-sqlite's `SQLiteDatabase` that `drizzle-orm/expo-sqlite`
 * calls, backed by `node:sqlite`. Only `prepareSync` is used: the session
 * prepares one statement per query and runs it through `executeSync` (run, and
 * `all` / `get` without field mapping) or `executeForRawResultSync` (positional
 * rows, which is every select built with the query builder). The driver never
 * finalizes its statements, so neither does this.
 *
 * Like the real client, `executeSync` steps the statement immediately, and
 * `changes` / `lastInsertRowId` come from `sqlite3_changes()` /
 * `sqlite3_last_insert_rowid()` after it ran.
 */
function createExpoSqliteClient(sqlite, record) {
    const counters = sqlite.prepare(
        "SELECT changes() AS changes, last_insert_rowid() AS lastInsertRowId"
    );
    function readCounters() {
        const { changes, lastInsertRowId } = counters.get();
        return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowId) };
    }

    return {
        prepareSync(sql) {
            const statement = sqlite.prepare(sql);
            const returnsRows = statement.columns().length > 0;
            function execute(params, method, positional) {
                record(sql, params, method);
                let rows = [];
                if (returnsRows) {
                    statement.setReturnArrays(positional);
                    rows = statement.all(...params);
                } else {
                    statement.run(...params);
                }
                return {
                    ...readCounters(),
                    getAllSync: () => rows,
                    getFirstSync: () => rows[0] ?? null,
                };
            }
            return {
                executeSync: (params = []) => execute(params, "executeSync", false),
                executeForRawResultSync: (params = []) =>
                    execute(params, "executeForRawResultSync", true),
            };
        },
    };
}

/**
 * @param {string[]} entryPoints repo-relative `.ts` paths to compile
 * @param {{
 *   stopAfterMigrations?: number,
 *   driver?: "sqlite-proxy" | "expo-sqlite",
 * }} [options]
 *   `stopAfterMigrations`: apply only the first N migrations, leaving the rest
 *   for `applyRemainingMigrations()`. Omit it and every migration is applied up
 *   front, exactly as before.
 *   `driver`: which drizzle driver the emitted `db` uses (see the file header).
 *   Defaults to `"sqlite-proxy"`. Use `"expo-sqlite"` to test transactions.
 * @returns {{
 *   load: (relativePath: string) => any,
 *   sqlite: InstanceType<typeof DatabaseSync>,
 *   queries: { sql: string, params: unknown[], method: string }[],
 *   resetQueries: () => void,
 *   migrationCount: number,
 *   applyRemainingMigrations: () => number,
 *   cleanup: () => void,
 * }}
 */
function createRepositoryHarness(entryPoints, options = {}) {
    const driver = options.driver ?? "sqlite-proxy";
    if (driver !== "sqlite-proxy" && driver !== "expo-sqlite") {
        throw new Error(`Unknown harness driver: ${driver}`);
    }

    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-repo-test-"));

    compile(entryPoints, outDir);
    absolutiseBareRequires(outDir);

    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON");
    let appliedMigrations = applyMigrations(
        sqlite,
        0,
        options.stopAfterMigrations ?? Infinity
    );

    const queries = [];
    function runQuery(sql, params, method) {
        queries.push({ sql, params, method });
        const statement = sqlite.prepare(sql);
        if (method === "run") {
            statement.run(...params);
            return { rows: [] };
        }
        statement.setReturnArrays(true);
        const rows = statement.all(...params);
        return { rows: method === "get" ? (rows[0] ?? []) : rows };
    }

    // Each harness gets its own global, so a second harness created in the same
    // file cannot redirect the first one's queries to its database.
    harnessCount += 1;
    const globalKey = `__snowlogHarnessClient${harnessCount}`;
    global[globalKey] =
        driver === "expo-sqlite"
            ? createExpoSqliteClient(sqlite, (sql, params, method) =>
                  queries.push({ sql, params, method })
              )
            : runQuery;

    const driverModule =
        driver === "expo-sqlite" ? "drizzle-orm/expo-sqlite/driver" : "drizzle-orm/sqlite-proxy";
    const databaseDir = path.join(outDir, "database");
    fs.writeFileSync(
        path.join(databaseDir, "index.js"),
        [
            `const { drizzle } = require(${JSON.stringify(
                require.resolve(driverModule, { paths: [repoRoot] })
            )});`,
            `const schema = require(${JSON.stringify(
                path.join(databaseDir, "schema.js")
            )});`,
            `exports.db = drizzle(global[${JSON.stringify(globalKey)}], { schema });`,
            `Object.assign(exports, schema);`,
            "",
        ].join("\n")
    );

    let cleaned = false;
    function cleanup() {
        if (cleaned) return;
        cleaned = true;
        fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 });
        delete global[globalKey];
    }
    process.on("exit", cleanup);

    return {
        load: (relativePath) => require(path.join(outDir, relativePath)),
        sqlite,
        queries,
        resetQueries: () => {
            queries.length = 0;
        },
        get migrationCount() {
            return appliedMigrations;
        },
        applyRemainingMigrations: () => {
            appliedMigrations = applyMigrations(sqlite, appliedMigrations);
            return appliedMigrations;
        },
        cleanup,
    };
}

module.exports = { createRepositoryHarness, repoRoot };
