// Order of the single-pick steps in src/app/video-import.tsx (handlePickVideo).
//
// Before: a new pick took a new generation before checking whether the movie was
// already imported, and never cleared isLoadingMeta. Picking an already-imported
// movie while another pick was still loading abandoned that pick, and a replaced
// pick that was loading left isLoadingMeta true (its finally skips the reset once
// stale), so Save stayed disabled for a following pick without a Photos lookup.
//
// The route cannot be rendered under node:test, so this checks the source order.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "src", "app", "video-import.tsx"),
    "utf8"
);
const start = source.indexOf("const asset = pickerResult.assets[0];");
const end = source.indexOf("/** 動画をインポートしてDBに保存する */", start);
const body = source.slice(start, end);

test("the pick handler is found", () => {
    assert.ok(start > 0 && end > start);
});

test("the already-imported check runs before the pick takes a new generation", () => {
    const lookup = body.indexOf("await getVideoByAssetId(");
    const bump = body.indexOf("++pickGenerationRef.current");
    assert.ok(lookup > 0 && bump > 0);
    assert.ok(lookup < bump, "getVideoByAssetId must come first");
    assert.equal(body.match(/\+\+pickGenerationRef\.current/g).length, 1);
});

test("the lookup gives up when the screen closed meanwhile", () => {
    assert.match(
        body,
        /const generationBeforeLookup = pickGenerationRef\.current;\s*const existing = await getVideoByAssetId\(asset\.assetId\);\s*\/\/[^\n]*\n\s*if \(generationBeforeLookup !== pickGenerationRef\.current\) return;/
    );
});

test("a new pick clears the loading state of the pick it replaces", () => {
    assert.match(
        body,
        /const generation = \+\+pickGenerationRef\.current;\s*const isStale = [^\n]*\n(\s*\/\/[^\n]*\n)*\s*setIsLoadingMeta\(false\);\s*await cleanupPickFiles\(\);/
    );
});
