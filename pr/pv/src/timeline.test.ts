import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENES } from "./script.ts";
import { resolveScenes, totalFrames } from "./timeline.ts";

test("falls back to the minimum duration when narration is missing", () => {
    const resolved = resolveScenes(SCENES, new Map(), 60);

    assert.equal(resolved[0].durationInFrames, 7 * 60);
    assert.equal(totalFrames(resolved), 78 * 60);
});

test("stretches a scene when narration plus tail exceeds the minimum", () => {
    // s01 has a 7s minimum and a 1.5s tail. 8s of speech needs 9.5s.
    const resolved = resolveScenes(SCENES, new Map([["s01", 8]]), 60);

    assert.equal(resolved[0].durationInFrames, Math.ceil(9.5 * 60));
});

test("keeps the minimum when narration plus tail is shorter", () => {
    const resolved = resolveScenes(SCENES, new Map([["s01", 2]]), 60);

    assert.equal(resolved[0].durationInFrames, 7 * 60);
});

test("lays scenes out back to back", () => {
    const resolved = resolveScenes(SCENES, new Map(), 60);

    assert.equal(resolved[0].from, 0);
    assert.equal(resolved[1].from, 7 * 60);
    assert.equal(resolved[2].from, 14 * 60);
});
