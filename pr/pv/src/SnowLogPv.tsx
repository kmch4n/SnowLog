import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { FlashCut } from "./components/FlashCut.tsx";
import { S01Hook } from "./scenes/S01Hook.tsx";
import { S02Grid } from "./scenes/S02Grid.tsx";
import { S03Logo } from "./scenes/S03Logo.tsx";
import { S04Import } from "./scenes/S04Import.tsx";
import { S05Record } from "./scenes/S05Record.tsx";
import { S06Calendar } from "./scenes/S06Calendar.tsx";
import { S07Dashboard } from "./scenes/S07Dashboard.tsx";
import { S08Privacy } from "./scenes/S08Privacy.tsx";
import { S09Cta } from "./scenes/S09Cta.tsx";
import { Palette } from "./theme/colors.ts";
import type { SceneId } from "./script.ts";
import type { ResolvedScene } from "./timeline.ts";

/**
 * A scene with its own narration-availability flag attached, computed once
 * in `calculateMetadata` from the `Map<SceneId, number>` that
 * `measureNarration` returns. This must stay per-scene: narration is
 * recorded a scene at a time, so a single global flag would make every
 * scene render an `<Audio>` pointing at a file that does not exist yet as
 * soon as the first narration file lands.
 */
export type SceneWithNarration = ResolvedScene & {
    hasNarration: boolean;
};

export type SnowLogPvProps = {
    scenes: SceneWithNarration[];
    hasBgm: boolean;
};

/** Exported so Root can register each scene as its own Composition. */
export const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
    s01: S01Hook,
    s02: S02Grid,
    s03: S03Logo,
    s04: S04Import,
    s05: S05Record,
    s06: S06Calendar,
    s07: S07Dashboard,
    s08: S08Privacy,
    s09: S09Cta,
};

/** Duck the music under narration so the voice stays legible. */
const BGM_BASE_VOLUME = 0.35;
const BGM_DUCKED_VOLUME = 0.09;

// Wall-clock, fps-independent: the fade envelope is expressed in seconds and
// converted with `fps` at the use site, never as raw frame counts.
const BGM_FADE_IN_SECONDS = 1;
const BGM_FADE_OUT_LEAD_SECONDS = 2;

export const SnowLogPv: React.FC<SnowLogPvProps> = ({ scenes, hasBgm }) => {
    const { fps, durationInFrames } = useVideoConfig();
    // Ducking is a whole-track decision (there is only one BGM track), so it
    // asks "does narration exist anywhere in the film", unlike the per-scene
    // `<Audio>` gate below.
    const hasAnyNarration = scenes.some((scene) => scene.hasNarration);

    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop }}>
            {scenes.map((scene, index) => {
                const Scene = SCENE_COMPONENTS[scene.id];

                return (
                    <Sequence
                        key={scene.id}
                        from={scene.from}
                        durationInFrames={scene.durationInFrames}
                        premountFor={fps}
                    >
                        <Scene />
                        {/* The flash marks a cut between scenes, so the first
                            scene has nothing to cut from. Flashing there would
                            open the film — and any auto-generated thumbnail —
                            on a pure white frame. */}
                        {index === 0 ? null : <FlashCut />}
                        {scene.hasNarration ? <Audio src={staticFile(scene.narrationFile)} /> : null}
                    </Sequence>
                );
            })}

            {hasBgm ? (
                <Audio
                    src={staticFile("audio/bgm.mp3")}
                    loop
                    loopVolumeCurveBehavior="extend"
                    volume={(f) =>
                        interpolate(
                            f,
                            // Strictly increasing only because `resolveScenes`
                            // (timeline.ts) guarantees the composition is at
                            // least `TOTAL_MIN_SECONDS * fps` frames long
                            // (script.ts). If that floor ever drops below a
                            // few seconds, this range stops being valid.
                            [
                                0,
                                fps * BGM_FADE_IN_SECONDS,
                                durationInFrames - fps * BGM_FADE_OUT_LEAD_SECONDS,
                                durationInFrames,
                            ],
                            [
                                0,
                                hasAnyNarration ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME,
                                hasAnyNarration ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME,
                                0,
                            ],
                            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                        )
                    }
                />
            ) : null}
        </AbsoluteFill>
    );
};
