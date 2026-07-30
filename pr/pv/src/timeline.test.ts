import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENES } from "./script.ts";
import { distributeFrames, resolveScenes, totalFrames } from "./timeline.ts";

test("falls back to the minimum duration when narration is missing", () => {
    const resolved = resolveScenes(SCENES, new Map(), 60);

    assert.equal(resolved[0].durationInFrames, 3 * 60);
    assert.equal(totalFrames(resolved), 94 * 60);
});

test("stretches a scene when narration plus tail exceeds the minimum", () => {
    // s01 has a 7s minimum and a 1.5s tail. 8s of speech needs 9.5s.
    const resolved = resolveScenes(SCENES, new Map([["s01", 8]]), 60);

    assert.equal(resolved[1].durationInFrames, Math.ceil(9.5 * 60));
});

test("rounds a fractional frame count up, not down or to nearest", () => {
    // s01 has a 1.5s tail. 7.02s of speech needs 8.52s, i.e.
    // 8.52 * 60 = 511.2 frames. The fractional part (.2) is below .5, so
    // Math.round and Math.floor both land on 511 while only Math.ceil
    // reaches 512 -- this is the only fixture that can tell them apart.
    const resolved = resolveScenes(SCENES, new Map([["s01", 7.02]]), 60);

    assert.equal(resolved[1].durationInFrames, 512);
});

test("keeps the minimum when narration plus tail is shorter", () => {
    const resolved = resolveScenes(SCENES, new Map([["s01", 2]]), 60);

    assert.equal(resolved[1].durationInFrames, 7 * 60);
});

test("lays scenes out back to back", () => {
    const resolved = resolveScenes(SCENES, new Map(), 60);

    // s00 runs 3s, s01 runs 7s.
    assert.equal(resolved[0].from, 0);
    assert.equal(resolved[1].from, 3 * 60);
    assert.equal(resolved[2].from, 10 * 60);
});

test("distributes a frame budget in proportion to the weights", () => {
    assert.deepEqual(distributeFrames([3.1, 1.6, 6.3], 660), [186, 96, 378]);
});

test("distributed parts always sum back to the budget exactly", () => {
    // 7 equal parts of 1000 frames is 142.857..., which drifts by 1 frame if
    // each part is rounded on its own. The scene would then end on a frame
    // with nothing rendered in it.
    const parts = distributeFrames([1, 1, 1, 1, 1, 1, 1], 1000);

    assert.equal(
        parts.reduce((sum, part) => sum + part, 0),
        1000,
    );
    assert.equal(parts.length, 7);
});

test("distributes a stretched budget without losing a frame", () => {
    const parts = distributeFrames([4.9, 6.1], 731);

    assert.equal(
        parts.reduce((sum, part) => sum + part, 0),
        731,
    );
});
