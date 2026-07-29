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

test("minimum durations add up to the designed 82 seconds", () => {
    assert.equal(TOTAL_MIN_SECONDS, 82);
});

test("every scene points at its own narration file", () => {
    for (const scene of SCENES) {
        assert.equal(scene.narrationFile, `audio/narration/${scene.id}.wav`);
    }
});

test("narration text stays within the spoken budget", () => {
    // 5.5 characters per second is the assumed Japanese reading speed. The tail
    // has to be counted too: resolveScenes stretches a scene to
    // narration + tailInSeconds, so ignoring the tail would assert an invariant
    // the timeline does not actually hold to.
    for (const scene of SCENES) {
        const spokenSeconds = scene.narrationText.length / 5.5;
        const neededSeconds = spokenSeconds + scene.tailInSeconds;
        assert.ok(
            neededSeconds <= scene.minDurationInSeconds,
            `${scene.id}: ${neededSeconds.toFixed(1)}s of speech plus tail does not fit in ${scene.minDurationInSeconds}s`,
        );
    }
});

test("every scene that shows captions has copy for them", () => {
    // s01 is deliberately caption-free: it is the full-bleed hook.
    for (const scene of SCENES) {
        if (scene.id === "s01") {
            assert.equal(scene.captions.length, 0);
            continue;
        }

        assert.ok(
            scene.captions.length > 0,
            `${scene.id} has no captions`,
        );
    }
});
