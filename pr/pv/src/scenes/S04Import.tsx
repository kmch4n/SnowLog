import { Series, useVideoConfig } from "remotion";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";

export const S04Import: React.FC = () => {
    const { fps } = useVideoConfig();

    return (
        <ScreenScene eyebrow="IMPORT" captions={["まとめて取り込む", "378のゲレンデを収録"]}>
            <Series>
                <Series.Sequence durationInFrames={Math.round(3.1 * fps)} premountFor={fps}>
                    <DeviceFrame src="screen/import-01.mp4" />
                </Series.Sequence>
                <Series.Sequence durationInFrames={Math.round(1.6 * fps)} premountFor={fps}>
                    <DeviceFrame src="screen/import-02.mp4" />
                </Series.Sequence>
                <Series.Sequence durationInFrames={Math.round(6.3 * fps)} premountFor={fps}>
                    <DeviceFrame
                        src="screen/import-03.mp4"
                        trimAfter={Math.round(6.3 * fps)}
                    />
                </Series.Sequence>
            </Series>
        </ScreenScene>
    );
};
