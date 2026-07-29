import { useVideoConfig } from "remotion";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";

/** `screen/detail.mp4` runs 16.3s; the first 2s are the tap that opens it. */
const SOURCE_SECONDS = 16.3;
const START_SECONDS = 2;
const AVAILABLE_SECONDS = SOURCE_SECONDS - START_SECONDS;

export const S05Record: React.FC = () => {
    const { fps, durationInFrames } = useVideoConfig();

    // Unlike the chained scenes, this one has spare footage past its designed
    // window, so a stretched scene shows more of the recording before it has to
    // fall back to slowing playback.
    const sceneSeconds = durationInFrames / fps;
    const usedSeconds = Math.min(sceneSeconds, AVAILABLE_SECONDS);
    const playbackRate =
        sceneSeconds > AVAILABLE_SECONDS ? AVAILABLE_SECONDS / sceneSeconds : 1;

    return (
        <ScreenScene eyebrow="RECORD" captions={["技術・タグ・メモ"]}>
            <DeviceFrame
                src="screen/detail.mp4"
                trimBefore={Math.round(START_SECONDS * fps)}
                trimAfter={Math.round((START_SECONDS + usedSeconds) * fps)}
                playbackRate={playbackRate}
            />
        </ScreenScene>
    );
};
