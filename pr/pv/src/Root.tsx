import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { SCENES } from "./script.ts";
import { SnowLogPv } from "./SnowLogPv.tsx";
import type { SnowLogPvProps } from "./SnowLogPv.tsx";
import { measureNarration, resolveScenes, staticFileExists, totalFrames } from "./timeline.ts";

const FPS = 60;

const calculateMetadata: CalculateMetadataFunction<SnowLogPvProps> = async () => {
    const narrationSeconds = await measureNarration(SCENES);
    const scenes = resolveScenes(SCENES, narrationSeconds, FPS);

    return {
        durationInFrames: totalFrames(scenes),
        props: {
            scenes,
            hasNarration: narrationSeconds.size > 0,
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
            defaultProps={{ scenes: [], hasNarration: false, hasBgm: false }}
            calculateMetadata={calculateMetadata}
        />
    );
};
