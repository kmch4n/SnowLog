import { Series, useVideoConfig } from "remotion";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";

export const S06Calendar: React.FC = () => {
    const { fps } = useVideoConfig();

    return (
        <ScreenScene eyebrow="LOOK BACK" captions={["カレンダーと日記"]}>
            <Series>
                <Series.Sequence durationInFrames={Math.round(4.9 * fps)} premountFor={fps}>
                    <DeviceFrame src="screen/calendar.mp4" />
                </Series.Sequence>
                <Series.Sequence durationInFrames={Math.round(6.1 * fps)} premountFor={fps}>
                    <DeviceFrame
                        src="screen/diary.mp4"
                        trimAfter={Math.round(6.1 * fps)}
                    />
                </Series.Sequence>
            </Series>
        </ScreenScene>
    );
};
