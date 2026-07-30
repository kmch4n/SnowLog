import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SCENES } from "./script.ts";

// This file is a test, so it never reaches the browser bundle and may use
// node: imports. Scene and component sources must not.
const SCENES_DIR = join(dirname(fileURLToPath(import.meta.url)), "scenes");

/** Hiragana, katakana, and CJK ideographs. */
const JAPANESE = /[぀-ヿ一-鿿]/;

const sceneSources = (): { name: string; source: string }[] =>
    readdirSync(SCENES_DIR)
        .filter((name) => name.endsWith(".tsx"))
        .map((name) => ({
            name,
            source: readFileSync(join(SCENES_DIR, name), "utf8"),
        }));

test("scene files hold no Japanese copy of their own", () => {
    // Captions used to be written into both script.ts and the scene that
    // renders them, with nothing keeping the two in step. script.ts is the
    // single source; a Japanese character in a scene file means a caption has
    // been inlined again.
    for (const { name, source } of sceneSources()) {
        const offendingLines = source
            .split("\n")
            .map((line, index) => ({ line, number: index + 1 }))
            .filter(({ line }) => JAPANESE.test(line));

        assert.deepEqual(
            offendingLines,
            [],
            `${name} contains Japanese text; it belongs in script.ts`,
        );
    }
});

test("every caption in the script reaches a scene file", () => {
    // The complement of the test above: script.ts could hold copy that nothing
    // renders, which is exactly the dead-data state this replaced.
    const sources = sceneSources()
        .map(({ source }) => source)
        .join("\n");

    for (const scene of SCENES) {
        if (scene.captions.length === 0) {
            continue;
        }

        assert.ok(
            sources.includes(`getScene("${scene.id}")`),
            `${scene.id} has captions but no scene file looks it up`,
        );
    }
});

test("no scene renders only its first caption", () => {
    // The test above is satisfied by a scene that looks its captions up and then
    // renders `captions[0]`, which is what S00Title and S03Logo did. A second
    // caption added to s03 disappeared without a single test failing. Rendering
    // the array makes dropping one structurally impossible, so forbid the
    // indexing outright rather than trying to detect the symptom.
    //
    // Matches source text, so it can be defeated by writing the index a
    // different way. It still catches the obvious regression, which is the one
    // that actually happened.
    for (const { name, source } of sceneSources()) {
        const indexed = source.match(/captions\s*\[\s*\d+\s*\]/g) ?? [];

        assert.deepEqual(
            indexed,
            [],
            `${name} picks captions out by index (${indexed.join(", ")}); map over them instead so none is dropped`,
        );
    }
});
