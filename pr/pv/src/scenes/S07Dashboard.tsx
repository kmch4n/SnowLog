import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";

export const S07Dashboard: React.FC = () => {
    return (
        <ScreenScene eyebrow="SEASON" captions={["シーズン単位で振り返る"]}>
            <DeviceFrame src="screen/dashboard.mp4" tiltDegrees={5} />
        </ScreenScene>
    );
};
