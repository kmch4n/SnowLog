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
 * 4. Overwrite the emitted `database/index.js` with a `drizzle-orm/sqlite-proxy`
 *    instance whose callback runs the SQL through `node:sqlite` and records it.
 *
 * Everything above `index.js` is the real shipped code.
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

function applyMigrations(sqlite) {
    const migrationsDir = path.join(repoRoot, "drizzle");
    const journal = JSON.parse(
        fs.readFileSync(path.join(migrationsDir, "meta", "_journal.json"), "utf8")
    );
    for (const entry of journal.entries) {
        const sql = fs.readFileSync(
            path.join(migrationsDir, `${entry.tag}.sql`),
            "utf8"
        );
        for (const statement of sql.split("--> statement-breakpoint")) {
            const trimmed = statement.trim();
            if (trimmed) sqlite.exec(trimmed);
        }
    }
    return journal.entries.length;
}

/**
 * @param {string[]} entryPoints repo-relative `.ts` paths to compile
 * @returns {{
 *   load: (relativePath: string) => any,
 *   sqlite: InstanceType<typeof DatabaseSync>,
 *   queries: { sql: string, params: unknown[], method: string }[],
 *   resetQueries: () => void,
 *   migrationCount: number,
 *   cleanup: () => void,
 * }}
 */
function createRepositoryHarness(entryPoints) {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-repo-test-"));

    compile(entryPoints, outDir);
    absolutiseBareRequires(outDir);

    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON");
    const migrationCount = applyMigrations(sqlite);

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

    const databaseDir = path.join(outDir, "database");
    fs.writeFileSync(
        path.join(databaseDir, "index.js"),
        [
            `const { drizzle } = require(${JSON.stringify(
                require.resolve("drizzle-orm/sqlite-proxy", { paths: [repoRoot] })
            )});`,
            `const schema = require(${JSON.stringify(
                path.join(databaseDir, "schema.js")
            )});`,
            `exports.db = drizzle(global.__snowlogRunQuery, { schema });`,
            `Object.assign(exports, schema);`,
            "",
        ].join("\n")
    );
    global.__snowlogRunQuery = runQuery;

    let cleaned = false;
    function cleanup() {
        if (cleaned) return;
        cleaned = true;
        fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 });
    }
    process.on("exit", cleanup);

    return {
        load: (relativePath) => require(path.join(outDir, relativePath)),
        sqlite,
        queries,
        resetQueries: () => {
            queries.length = 0;
        },
        migrationCount,
        cleanup,
    };
}

module.exports = { createRepositoryHarness, repoRoot };
