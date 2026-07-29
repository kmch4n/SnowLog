import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { SCENES } from "./script.ts";
import { SnowLogPv } from "./SnowLogPv.tsx";
import type { SnowLogPvProps } from "./SnowLogPv.tsx";
import { measureNarration, resolveScenes, staticFileExists, totalFrames } from "./timeline.ts";

const FPS = 60;

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
        <Composition
            id="SnowLogPv"
            component={SnowLogPv}
            durationInFrames={78 * FPS}
            fps={FPS}
            width={1920}
            height={1080}
            defaultProps={{ scenes: [], hasBgm: false }}
            calculateMetadata={calculateMetadata}
        />
    );
};
