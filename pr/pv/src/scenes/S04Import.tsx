import { Series, useVideoConfig } from "remotion";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";
import { distributeFrames } from "../timeline.ts";

/** Natural length of each recording, in seconds, in playback order. */
const CLIP_SECONDS = [3.1, 1.6, 6.3] as const;
const NATURAL_SECONDS = CLIP_SECONDS.reduce((total, seconds) => total + seconds, 0);

const CLIP_SOURCES = [
    "screen/import-01.mp4",
    "screen/import-02.mp4",
    "screen/import-03.mp4",
] as const;

export const S04Import: React.FC = () => {
    const { fps, durationInFrames } = useVideoConfig();

    // The scene grows when its narration outruns the designed minimum. The
    // recordings are a fixed length, so slow them by exactly the stretch factor
    // rather than letting the Series run dry and leave the column empty.
    const naturalInFrames = NATURAL_SECONDS * fps;
    const stretch = durationInFrames / naturalInFrames;
    const playbackRate = stretch > 1 ? 1 / stretch : 1;
    const clipFrames = distributeFrames([...CLIP_SECONDS], durationInFrames);

    return (
        <ScreenScene eyebrow="IMPORT" captions={["まとめて取り込む", "378のゲレンデを収録"]}>
            <Series>
                {CLIP_SOURCES.map((src, index) => (
                    <Series.Sequence
                        key={src}
                        durationInFrames={clipFrames[index]}
                        premountFor={fps}
                    >
                        <DeviceFrame src={src} playbackRate={playbackRate} />
                    </Series.Sequence>
                ))}
            </Series>
        </ScreenScene>
    );
};
