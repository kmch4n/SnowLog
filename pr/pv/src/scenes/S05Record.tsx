import { useVideoConfig } from "remotion";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";

export const S05Record: React.FC = () => {
    const { fps } = useVideoConfig();

    return (
        <ScreenScene eyebrow="RECORD" captions={["技術・タグ・メモ"]}>
            <DeviceFrame
                src="screen/detail.mp4"
                trimBefore={Math.round(2 * fps)}
                trimAfter={Math.round(14 * fps)}
            />
        </ScreenScene>
    );
};
