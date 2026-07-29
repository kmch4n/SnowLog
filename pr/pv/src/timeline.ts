import { Input, ALL_FORMATS, UrlSource } from "mediabunny";
import { staticFile } from "remotion";
import type { SceneId, SceneSpec } from "./script.ts";

/**
 * Checks whether a `staticFile()`-style path (relative to `public/`) is
 * reachable. Reusable for any asset under `public/`, not just narration
 * audio -- e.g. the same check is needed for `audio/bgm.mp3`.
 *
 * `calculateMetadata` -- the only real caller of `measureNarration` -- runs
 * in a browser context: the Studio evaluates it in the page, and
 * `remotion render` evaluates it in headless Chrome. It is never evaluated
 * in plain Node, so this module must stay free of any Node.js-only imports
 * and must not do anything at module-evaluation time that assumes a
 * filesystem. A
 * HEAD request against `staticFile()`'s URL is what actually works in that
 * environment: a non-ok response, or a throw (asset unreachable for any
 * reason), both mean "not recorded yet" and are treated identically.
 */
export const staticFileExists = async (
    relativePath: string,
): Promise<boolean> => {
    try {
        const response = await fetch(staticFile(relativePath), {
            method: "HEAD",
        });
        return response.ok;
    } catch {
        return false;
    }
};

export type ResolvedScene = SceneSpec & {
    durationInFrames: number;
    /** Absolute start frame within the composition. */
    from: number;
};

/**
 * Turns narration lengths into scene lengths.
 *
 * A scene lasts for whichever is longer: its designed minimum, or the
 * narration plus its tail. Scenes without narration keep their minimum, which
 * is what lets the whole film render before any audio has been recorded.
 */
export const resolveScenes = (
    scenes: readonly SceneSpec[],
    narrationSeconds: ReadonlyMap<SceneId, number>,
    fps: number,
): ResolvedScene[] => {
    let cursor = 0;

    return scenes.map((scene) => {
        const narration = narrationSeconds.get(scene.id);
        const spokenSeconds =
            narration === undefined ? 0 : narration + scene.tailInSeconds;
        const seconds = Math.max(scene.minDurationInSeconds, spokenSeconds);
        const durationInFrames = Math.ceil(seconds * fps);
        const resolved = { ...scene, durationInFrames, from: cursor };

        cursor += durationInFrames;
        return resolved;
    });
};

export const totalFrames = (resolved: readonly ResolvedScene[]): number =>
    resolved.reduce((total, scene) => total + scene.durationInFrames, 0);

/**
 * Reads the real length of each narration file. A missing file is the
 * designed-for state before its voice-over has been recorded, and is skipped
 * silently so an incomplete voice-over set never blocks a render. A file
 * that exists but cannot be measured -- corrupted audio, an unsupported
 * container -- is a real problem, so that case (and only that case) logs a
 * warning naming the scene. Without the existence check first, every scene
 * would warn in the common pre-recording state, drowning out the one
 * warning that actually matters once real audio exists.
 */
export const measureNarration = async (
    scenes: readonly SceneSpec[],
): Promise<Map<SceneId, number>> => {
    const entries = await Promise.all(
        scenes.map(async (scene): Promise<[SceneId, number] | null> => {
            if (!(await staticFileExists(scene.narrationFile))) {
                return null;
            }

            try {
                const input = new Input({
                    formats: ALL_FORMATS,
                    source: new UrlSource(staticFile(scene.narrationFile), {
                        getRetryDelay: () => null,
                    }),
                });
                return [scene.id, await input.computeDuration()];
            } catch (error) {
                console.warn(
                    `[timeline] Failed to measure narration for ${scene.id} ` +
                        `(${scene.narrationFile}): ${error}`,
                );
                return null;
            }
        }),
    );

    return new Map(entries.filter((entry) => entry !== null));
};
