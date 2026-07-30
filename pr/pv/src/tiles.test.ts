import assert from "node:assert/strict";
import { test } from "node:test";
import { tileOrder } from "./tiles.ts";

const TILES = 48;
const SOURCES = 8;
const COLUMNS = 6;

test("fills every tile", () => {
    assert.equal(tileOrder(TILES, SOURCES, COLUMNS).length, TILES);
});

test("uses every source image, evenly", () => {
    const order = tileOrder(TILES, SOURCES, COLUMNS);
    const counts = new Map<number, number>();

    for (const source of order) {
        counts.set(source, (counts.get(source) ?? 0) + 1);
    }

    assert.equal(counts.size, SOURCES);
    for (const [source, count] of counts) {
        assert.equal(count, TILES / SOURCES, `source ${source} appears ${count} times`);
    }
});

test("never repeats a neighbour", () => {
    // This is the whole point: a repeat next to itself is what made the old
    // modulo layout read as one photo tiled.
    const order = tileOrder(TILES, SOURCES, COLUMNS);

    for (let index = 0; index < order.length; index++) {
        if (index % COLUMNS !== 0) {
            assert.notEqual(order[index], order[index - 1], `tile ${index} matches its left`);
        }
        if (index >= COLUMNS) {
            assert.notEqual(order[index], order[index - COLUMNS], `tile ${index} matches the one above`);
        }
    }
});

test("breaks up the periodic banding of the layout it replaced", () => {
    // The old `index % count` put each photo at a perfectly regular interval,
    // which at 6 columns drew diagonal stripes across the grid — that is what
    // made it read as one picture tiled, not adjacent duplicates. With 8
    // sources and 6 columns the modulo layout never repeats a neighbour
    // either, so the neighbour test above cannot tell the two apart; this one
    // can, by asserting the spacing is irregular.
    const order = tileOrder(TILES, SOURCES, COLUMNS);
    let irregular = 0;

    for (let source = 0; source < SOURCES; source++) {
        const positions = order.flatMap((value, index) => (value === source ? [index] : []));
        const gaps = positions.slice(1).map((position, i) => position - positions[i]);

        if (new Set(gaps).size > 1) {
            irregular += 1;
        }
    }

    assert.ok(
        irregular >= SOURCES - 1,
        `${SOURCES - irregular} of ${SOURCES} sources are still evenly spaced`,
    );
});

test("is deterministic, so parallel frame renders agree", () => {
    // Remotion renders frames in parallel and out of order. If this varied
    // between calls the grid would flicker in the finished video while every
    // individual still looked correct.
    assert.deepEqual(
        tileOrder(TILES, SOURCES, COLUMNS),
        tileOrder(TILES, SOURCES, COLUMNS),
    );
});
