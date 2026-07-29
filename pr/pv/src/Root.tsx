import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { SCENES, TOTAL_MIN_SECONDS } from "./script.ts";
import { SCENE_COMPONENTS, SnowLogPv } from "./SnowLogPv.tsx";
import type { SnowLogPvProps } from "./SnowLogPv.tsx";
import { measureNarration, resolveScenes, staticFileExists, totalFrames } from "./timeline.ts";

const FPS = 60;
const WIDTH = 1920;
const HEIGHT = 1080;

const calculateMetadata: CalculateMetadataFunction<SnowLogPvProps> = async () => {
    const narrationSeconds = await measureNarration(SCENES);
    // Carry the per-scene answer through instead of collapsing it into one
    // global flag: narration is recorded a scene at a time, so each scene
    // must gate its own `<Audio>` on whether its own file was found.
    const scenes = resolveScenes(SCENES, narrationSeconds, FPS).map((scene) => ({
        ...scene,
        hasNarration: narrationSeconds.has(scene.id),
    }));

    return {
        durationInFrames: totalFrames(scenes),
        props: {
            scenes,
            hasBgm: await staticFileExists("audio/bgm.mp3"),
        },
    };
};

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="SnowLogPv"
                component={SnowLogPv}
                // Only the fallback before calculateMetadata resolves; deriving
                // it from the script keeps it honest when a scene length changes.
                durationInFrames={TOTAL_MIN_SECONDS * FPS}
                fps={FPS}
                width={WIDTH}
                height={HEIGHT}
                defaultProps={{ scenes: [], hasBgm: false }}
                calculateMetadata={calculateMetadata}
            />

            {/* One composition per scene, so a single scene can be previewed and
                re-rendered without stepping through the whole film. */}
            {SCENES.map((scene) => (
                <Composition
                    key={scene.id}
                    id={scene.title.replace(/\s+/g, "")}
                    component={SCENE_COMPONENTS[scene.id]}
                    durationInFrames={Math.round(scene.minDurationInSeconds * FPS)}
                    fps={FPS}
                    width={WIDTH}
                    height={HEIGHT}
                />
            ))}
        </>
    );
};
