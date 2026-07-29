import { random } from "remotion";

/**
 * Assigns a source image to every tile of the S2 grid.
 *
 * The grid is much larger than the set of photos, and the old `index % count`
 * laid them out in a strict cycle, which read as one picture tiled rather than
 * a library of clips. This deals a fresh shuffle of the whole set for each
 * block of tiles — so every photo still appears equally often — and then picks
 * greedily so that no tile matches the one to its left or the one above it.
 *
 * The seed depends only on the block index, never on the frame. Remotion
 * renders frames in parallel and out of order, so a frame-dependent shuffle
 * would make the grid flicker in the finished video while looking perfectly
 * fine in any single still.
 */
export const tileOrder = (
    tileCount: number,
    sourceCount: number,
    columns: number,
): number[] => {
    const order: number[] = [];
    let pool: number[] = [];
    let block = 0;

    for (let index = 0; index < tileCount; index++) {
        if (pool.length === 0) {
            pool = shuffled(sourceCount, block);
            block += 1;
        }

        const left = index % columns === 0 ? -1 : order[index - 1];
        const above = index >= columns ? order[index - columns] : -1;

        // Falls back to the first candidate when every remaining one collides,
        // which only happens with a very small source set.
        const pick = Math.max(
            pool.findIndex((source) => source !== left && source !== above),
            0,
        );

        order.push(pool[pick]);
        pool.splice(pick, 1);
    }

    return order;
};

/** Fisher-Yates driven by Remotion's deterministic seeded random. */
const shuffled = (count: number, block: number): number[] => {
    const values = Array.from({ length: count }, (_, index) => index);

    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(random(`grid-tile-${block}-${i}`) * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }

    return values;
};
