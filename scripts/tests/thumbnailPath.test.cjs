// isSafeThumbnailPath is the last check before deleteThumbnail removes a file,
// and it runs on whatever the database holds — including rows restored before
// restored paths were validated. It must refuse anything that is not a plain
// file directly inside thumbnails/.
//
// The module has no imports, so a bare `tsc <file>` emits flat. See
// .memory/testing.md.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "snowlog-thumbnail-path-"));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 3 }));

execFileSync(
    process.execPath,
    [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "src/utils/thumbnailPath.ts",
        "--outDir", outDir,
        "--target", "ES2020",
        "--module", "commonjs",
        "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" }
);

const { isSafeThumbnailPath } = require(path.join(outDir, "thumbnailPath.js"));

test("a thumbnail the app writes is safe to delete", () => {
    assert.equal(isSafeThumbnailPath("thumbnails/0f8e1c2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b.jpg"), true);
    assert.equal(isSafeThumbnailPath("thumbnails/v_1-2.jpg"), true);
});

test("a path that leaves the thumbnail directory is refused", () => {
    for (const hostile of [
        "thumbnails/../SQLite/snowlog.db",
        "thumbnails/../snowlog.jpg",
        "thumbnails/..jpg",
        "thumbnails/./v1.jpg",
        "thumbnails/sub/v1.jpg",
        "thumbnails/..\\v1.jpg",
        "thumbnails/%2e%2e/v1.jpg",
    ]) {
        assert.equal(isSafeThumbnailPath(hostile), false, hostile);
    }
});

test("a path outside the thumbnail directory is refused", () => {
    for (const hostile of [
        "",
        "thumbnails/",
        "SQLite/snowlog.db",
        "videos/v1.jpg",
        "/thumbnails/v1.jpg",
        "file:///var/Documents/thumbnails/v1.jpg",
        "THUMBNAILS/v1.jpg",
    ]) {
        assert.equal(isSafeThumbnailPath(hostile), false, hostile);
    }
});

test("only the jpg files the app writes are accepted", () => {
    assert.equal(isSafeThumbnailPath("thumbnails/v1.db"), false);
    assert.equal(isSafeThumbnailPath("thumbnails/v1"), false);
    assert.equal(isSafeThumbnailPath("thumbnails/v1.jpg.db"), false);
    assert.equal(isSafeThumbnailPath("thumbnails/v1.jpg/"), false);
});
