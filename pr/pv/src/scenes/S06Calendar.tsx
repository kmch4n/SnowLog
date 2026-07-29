import { Series, useVideoConfig } from "remotion";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";
import { getScene } from "../script.ts";
import { distributeFrames } from "../timeline.ts";

/** Natural length of each recording, in seconds, in playback order. */
const CLIP_SECONDS = [4.9, 6.1] as const;
const NATURAL_SECONDS = CLIP_SECONDS.reduce((total, seconds) => total + seconds, 0);

const CLIP_SOURCES = ["screen/calendar.mp4", "screen/diary.mp4"] as const;

export const S06Calendar: React.FC = () => {
    const scene = getScene("s06");
    const { fps, durationInFrames } = useVideoConfig();

    // See S04Import: a stretched scene slows its clips rather than running out
    // of footage part-way through.
    const naturalInFrames = NATURAL_SECONDS * fps;
    const stretch = durationInFrames / naturalInFrames;
    const playbackRate = stretch > 1 ? 1 / stretch : 1;
    const clipFrames = distributeFrames([...CLIP_SECONDS], durationInFrames);

    return (
        <ScreenScene eyebrow={scene.eyebrow} captions={scene.captions}>
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
