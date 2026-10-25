// The Web replacement for Alert.alert (react-native-web ships a no-op, so on
// Web every confirmation silently did nothing and deletes could not run).
//
// The properties that matter: one dialog at a time in arrival order, the
// pressed button's handler runs exactly once and only after its dialog has
// closed, and Escape maps to the cancel button rather than a destructive one.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-webalert-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/webAlertQueue.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

// The queue is module state, so each test gets a fresh copy of the module.
function load() {
    const file = path.join(outDir, "webAlertQueue.js");
    delete require.cache[require.resolve(file)];
    return require(file);
}

function watch(queue) {
    const seen = [];
    queue.subscribeWebAlert((current) => seen.push(current));
    return seen;
}

test("dialogs are shown one at a time, in arrival order", () => {
    const queue = load();
    const seen = watch(queue);
    queue.enqueueWebAlert("first");
    queue.enqueueWebAlert("second");

    assert.equal(seen.at(-1).title, "first");
    queue.resolveWebAlert(seen.at(-1).id, 0);
    assert.equal(seen.at(-1).title, "second");
    queue.resolveWebAlert(seen.at(-1).id, 0);
    assert.equal(seen.at(-1), null);
});

test("no buttons means a single OK, as on native", () => {
    const queue = load();
    const seen = watch(queue);
    queue.enqueueWebAlert("title", "body", undefined, "OK");
    assert.deepEqual(seen.at(-1).buttons, [{ text: "OK" }]);
});

test("the pressed handler runs once, after its dialog has closed", () => {
    const queue = load();
    const seen = watch(queue);
    const calls = [];
    queue.enqueueWebAlert("delete?", undefined, [
        { text: "Cancel", style: "cancel", onPress: () => calls.push("cancel") },
        {
            text: "Delete",
            style: "destructive",
            // A handler that opens the next alert, like a delete that reports failure.
            onPress: () => {
                calls.push(["delete", seen.at(-1)]);
                queue.enqueueWebAlert("failed");
            },
        },
    ]);
    const { id } = seen.at(-1);
    queue.resolveWebAlert(id, 1);
    queue.resolveWebAlert(id, 1);

    assert.equal(calls.length, 1, "a stale or repeated resolve must not run the handler again");
    assert.deepEqual(calls[0], ["delete", null], "the dialog must be closed when the handler runs");
    assert.equal(seen.at(-1).title, "failed", "an alert raised from the handler must be shown");
});

test("Escape presses cancel, never the destructive button", () => {
    const queue = load();
    const seen = watch(queue);
    queue.enqueueWebAlert("delete?", undefined, [
        { text: "Delete", style: "destructive" },
        { text: "Cancel", style: "cancel" },
    ]);
    assert.equal(queue.cancelButtonIndex(seen.at(-1)), 1);

    queue.enqueueWebAlert("notice", undefined, [{ text: "OK" }]);
    queue.resolveWebAlert(seen.at(-1).id, null);
    assert.equal(queue.cancelButtonIndex(seen.at(-1)), 0, "a lone button is the way out");

    queue.enqueueWebAlert("choose", undefined, [{ text: "A" }, { text: "B" }]);
    queue.resolveWebAlert(seen.at(-1).id, null);
    assert.equal(queue.cancelButtonIndex(seen.at(-1)), null, "no cancel: close without choosing");
});
