import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENES, TOTAL_MIN_SECONDS } from "./script.ts";

test("covers all nine scenes in order", () => {
    assert.equal(SCENES.length, 9);
    assert.deepEqual(
        SCENES.map((scene) => scene.id),
        ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "s09"],
    );
});

test("minimum durations add up to the designed 78 seconds", () => {
    assert.equal(TOTAL_MIN_SECONDS, 78);
});

test("every scene points at its own narration file", () => {
    for (const scene of SCENES) {
        assert.equal(scene.narrationFile, `audio/narration/${scene.id}.wav`);
    }
});

test("narration text stays within the spoken budget", () => {
    // 5.5 characters per second is the assumed Japanese reading speed.
    for (const scene of SCENES) {
        const spokenSeconds = scene.narrationText.length / 5.5;
        assert.ok(
            spokenSeconds <= scene.minDurationInSeconds,
            `${scene.id}: ${spokenSeconds.toFixed(1)}s of speech does not fit in ${scene.minDurationInSeconds}s`,
        );
    }
});
