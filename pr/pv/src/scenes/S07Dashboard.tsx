import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";
import { getScene } from "../script.ts";

export const S07Dashboard: React.FC = () => {
    const scene = getScene("s07");
    return (
        <ScreenScene eyebrow={scene.eyebrow} captions={scene.captions}>
            <DeviceFrame src="screen/dashboard.mp4" tiltDegrees={5} />
        </ScreenScene>
    );
};
