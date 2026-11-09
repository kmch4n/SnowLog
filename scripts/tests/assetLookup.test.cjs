// lookupAssetWithDownload must tell "the library has no such asset" apart from
// "the lookup failed" (#91). The native module resolves null for a missing
// asset, which is also what a pick outside a Limited Photos selection gets; a
// thrown error is a failure and must never be read as "outside the selection".
//
// mediaService imports expo-media-library, which cannot load under Node, so the
// compiled module is run against a stub that scripts each getAssetInfoAsync call.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-asset-lookup-test-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/services/mediaService.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--esModuleInterop",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

// Each test sets `script`: one entry per expected getAssetInfoAsync call, either
// a value to resolve or an Error to throw. `calls` records the options passed.
let script = [];
let calls = [];
const mediaLibraryStub = {
    async getAssetInfoAsync(_id, options) {
        calls.push(options);
        const next = script.shift();
        if (next instanceof Error) throw next;
        return next;
    },
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === "expo-media-library") return mediaLibraryStub;
    return originalLoad.call(this, request, ...rest);
};
// The emit is rooted at src/ because mediaService imports ../utils.
const { lookupAssetWithDownload, getAssetInfoWithDownload } = require(
    path.join(outDir, "services", "mediaService.js")
);
Module._load = originalLoad;

function photosError() {
    // isPhotosLibraryError matches on the PHPhotosErrorDomain name in the message
    // (see src/utils/photosErrors.ts).
    return new Error("PHPhotosErrorDomain error 3164");
}

test.beforeEach(() => {
    script = [];
    calls = [];
});

test("an asset the library returns is found, without a network retry", async () => {
    const info = { id: "A", localUri: "file:///a.mov" };
    script = [info];
    assert.deepEqual(await lookupAssetWithDownload("A"), { status: "found", info });
    assert.deepEqual(calls, [{ shouldDownloadFromNetwork: false }]);
});

test("a null from the library is notFound, not failed", async () => {
    script = [null];
    assert.deepEqual(await lookupAssetWithDownload("A"), { status: "notFound" });
});

test("a non-Photos error is failed and is not retried over the network", async () => {
    script = [new Error("something else")];
    assert.deepEqual(await lookupAssetWithDownload("A"), { status: "failed" });
    assert.equal(calls.length, 1);
});

test("a Photos error retries with download; its null is notFound, its throw failed", async () => {
    script = [photosError(), null];
    assert.deepEqual(await lookupAssetWithDownload("A"), { status: "notFound" });
    assert.deepEqual(calls[1], { shouldDownloadFromNetwork: true });

    script = [photosError(), new Error("network")];
    assert.deepEqual(await lookupAssetWithDownload("A"), { status: "failed" });
});

test("getAssetInfoWithDownload still returns the info or null", async () => {
    const info = { id: "A" };
    script = [info];
    assert.equal(await getAssetInfoWithDownload("A"), info);
    script = [null];
    assert.equal(await getAssetInfoWithDownload("A"), null);
    script = [new Error("x")];
    assert.equal(await getAssetInfoWithDownload("A"), null);
});
