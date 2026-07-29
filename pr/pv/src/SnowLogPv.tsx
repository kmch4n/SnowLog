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

export type SnowLogPvProps = {
    scenes: ResolvedScene[];
    /** True when at least one narration file was found. */
    hasNarration: boolean;
    hasBgm: boolean;
};

const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
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

export const SnowLogPv: React.FC<SnowLogPvProps> = ({ scenes, hasNarration, hasBgm }) => {
    const { fps, durationInFrames } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop }}>
            {scenes.map((scene) => {
                const Scene = SCENE_COMPONENTS[scene.id];

                return (
                    <Sequence
                        key={scene.id}
                        from={scene.from}
                        durationInFrames={scene.durationInFrames}
                        premountFor={fps}
                    >
                        <Scene />
                        <FlashCut />
                        {hasNarration ? <Audio src={staticFile(scene.narrationFile)} /> : null}
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
                            [
                                0,
                                fps * BGM_FADE_IN_SECONDS,
                                durationInFrames - fps * BGM_FADE_OUT_LEAD_SECONDS,
                                durationInFrames,
                            ],
                            [
                                0,
                                hasNarration ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME,
                                hasNarration ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME,
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
