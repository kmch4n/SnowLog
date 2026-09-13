// The serial mutation coordinator from #86 section 6.
//
// Two properties carry the weight: operations never overlap, and cancelling
// does not have to wait for the thing it is cancelling. The second is easy to
// get wrong — a cancel that queues behind the running operation can only take
// effect after that operation finishes, which is the opposite of cancelling.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-coord-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/services/mediaMutationCoordinator.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const { MediaMutationCoordinator } = require(
    path.join(outDir, "mediaMutationCoordinator.js")
);

function deferred() {
    let resolve;
    const promise = new Promise((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

test("operations do not overlap", async () => {
    const coordinator = new MediaMutationCoordinator();
    const order = [];
    let active = 0;
    let maxActive = 0;

    const work = (name) =>
        coordinator.run(async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            order.push(`${name}:start`);
            await new Promise((resolve) => setImmediate(resolve));
            order.push(`${name}:end`);
            active -= 1;
            return name;
        });

    const results = await Promise.all([work("a"), work("b"), work("c")]);

    assert.equal(maxActive, 1, "two operations ran at once");
    assert.deepEqual(order, [
        "a:start", "a:end",
        "b:start", "b:end",
        "c:start", "c:end",
    ]);
    assert.deepEqual(results, ["a", "b", "c"]);
});

test("a failing operation does not stall the queue", async () => {
    const coordinator = new MediaMutationCoordinator();
    const failed = coordinator.run(async () => {
        throw new Error("boom");
    });
    const after = coordinator.run(async () => "ran anyway");

    await assert.rejects(() => failed, /boom/);
    assert.equal(await after, "ran anyway");
});

test("cancelling reaches the running operation without waiting for it", async () => {
    const coordinator = new MediaMutationCoordinator();
    const started = deferred();
    const release = deferred();
    let sawCancel = false;

    const running = coordinator.run(async (handle) => {
        started.resolve();
        await release.promise;
        sawCancel = handle.isCancelled;
        return "done";
    });

    await started.promise;
    // The operation is still in flight. If cancelAll queued behind it, this
    // call could not return until the operation finished.
    coordinator.cancelAll();
    release.resolve();

    assert.equal(await running, "done");
    assert.equal(sawCancel, true, "the running operation never saw the cancel");
});

test("cancelling also marks work that has not started", async () => {
    const coordinator = new MediaMutationCoordinator();
    const release = deferred();
    const seen = [];

    const first = coordinator.run(async () => {
        await release.promise;
    });
    const second = coordinator.run(async (handle) => {
        seen.push(handle.isCancelled);
    });

    coordinator.cancelAll();
    release.resolve();
    await Promise.all([first, second]);

    assert.deepEqual(seen, [true], "a queued operation started unaware it was cancelled");
});

test("the queue reports what is outstanding", async () => {
    const coordinator = new MediaMutationCoordinator();
    assert.equal(coordinator.pendingCount, 0);
    assert.equal(coordinator.isBusy, false);

    const release = deferred();
    const first = coordinator.run(async () => {
        await release.promise;
    });
    const second = coordinator.run(async () => {});

    assert.equal(coordinator.pendingCount, 2);
    assert.equal(coordinator.isBusy, true);

    release.resolve();
    await Promise.all([first, second]);

    assert.equal(coordinator.pendingCount, 0);
    assert.equal(coordinator.isBusy, false);
});

test("work queued from inside an operation still runs after it", async () => {
    // Deletion cancels and joins a transfer before committing, so nesting a
    // follow-up onto the same queue must not deadlock or reorder.
    const coordinator = new MediaMutationCoordinator();
    const order = [];

    await coordinator.run(async () => {
        order.push("outer:start");
        const inner = coordinator.run(async () => {
            order.push("inner");
        });
        order.push("outer:end");
        // Deliberately not awaited inside: awaiting a queued operation from
        // within the running one would wait forever on a serial queue.
        void inner;
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(order, ["outer:start", "outer:end", "inner"]);
});
