const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-debounced-task-"));
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

execFileSync(
    process.execPath,
    [
        tscBin,
        "src/utils/debouncedTask.ts",
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

const { createDebouncedTask } = require(path.join(outDir, "debouncedTask.js"));

test("a scheduled task runs once after the delay", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = [];
    const task = createDebouncedTask(1000);

    task.schedule(() => calls.push("a"));
    t.mock.timers.tick(999);
    assert.deepEqual(calls, []);
    t.mock.timers.tick(1);
    assert.deepEqual(calls, ["a"]);
    t.mock.timers.tick(5000);
    assert.deepEqual(calls, ["a"]);
});

test("rescheduling replaces the pending task and restarts the delay", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = [];
    const task = createDebouncedTask(1000);

    task.schedule(() => calls.push("a"));
    t.mock.timers.tick(600);
    task.schedule(() => calls.push("ab"));
    t.mock.timers.tick(600);
    assert.deepEqual(calls, []);
    t.mock.timers.tick(400);
    assert.deepEqual(calls, ["ab"]);
});

test("flush runs the pending task immediately instead of dropping it", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = [];
    const task = createDebouncedTask(1000);

    task.schedule(() => calls.push("typed before leaving"));
    t.mock.timers.tick(300);
    task.flush();
    assert.deepEqual(calls, ["typed before leaving"]);

    // The timer that was armed must not run it a second time.
    t.mock.timers.tick(5000);
    assert.deepEqual(calls, ["typed before leaving"]);
});

test("flush is a no-op when nothing is pending", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = [];
    const task = createDebouncedTask(1000);

    task.flush();
    assert.deepEqual(calls, []);

    task.schedule(() => calls.push("a"));
    t.mock.timers.tick(1000);
    task.flush();
    assert.deepEqual(calls, ["a"]);
});

test("cancel drops the pending task without running it", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = [];
    const task = createDebouncedTask(1000);

    task.schedule(() => calls.push("a"));
    task.cancel();
    t.mock.timers.tick(5000);
    task.flush();
    assert.deepEqual(calls, []);
});

test("separate instances do not share a pending task", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const calls = [];
    const title = createDebouncedTask(1000);
    const memo = createDebouncedTask(1000);

    title.schedule(() => calls.push("title"));
    memo.schedule(() => calls.push("memo"));
    title.flush();
    assert.deepEqual(calls, ["title"]);
    t.mock.timers.tick(1000);
    assert.deepEqual(calls, ["title", "memo"]);
});
