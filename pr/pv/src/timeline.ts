import { Input, ALL_FORMATS, UrlSource } from "mediabunny";
import { staticFile } from "remotion";
import type { SceneId, SceneSpec } from "./script.ts";

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
 * Reads the real length of each narration file. Missing files are skipped so
 * that an incomplete voice-over set never blocks a render, but every failure
 * is logged so a corrupted or misnamed file — as opposed to one that simply
 * has not been recorded yet — is still discoverable. Without this warning a
 * truncated scene looks identical to the intended pre-recording state.
 */
export const measureNarration = async (
    scenes: readonly SceneSpec[],
): Promise<Map<SceneId, number>> => {
    const entries = await Promise.all(
        scenes.map(async (scene): Promise<[SceneId, number] | null> => {
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
