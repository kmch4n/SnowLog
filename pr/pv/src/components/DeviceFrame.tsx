import { Video } from "@remotion/media";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";

const SCREEN_HEIGHT = 960;
const SCREEN_WIDTH = Math.round((SCREEN_HEIGHT * 592) / 1280);
const BEZEL = 14;

export const DeviceFrame: React.FC<{
    src: string;
    trimBefore?: number;
    trimAfter?: number;
    tiltDegrees?: number;
}> = ({ src, trimBefore, trimAfter, tiltDegrees = 8 }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // Slow drift so the frame never sits perfectly still.
    const rotateY = interpolate(
        frame,
        [0, durationInFrames],
        [tiltDegrees, -tiltDegrees],
    );

    return (
        <div style={{ perspective: 2000, display: "grid", placeItems: "center", height: "100%" }}>
            <div
                style={{
                    transform: `rotateY(${rotateY}deg)`,
                    transformStyle: "preserve-3d",
                    padding: BEZEL,
                    borderRadius: 52,
                    backgroundColor: "#05121F",
                    boxShadow: `0 60px 120px rgba(0,0,0,0.55), 0 0 0 1px ${Palette.primary}40`,
                }}
            >
                <Video
                    src={staticFile(src)}
                    trimBefore={trimBefore}
                    trimAfter={trimAfter}
                    muted
                    style={{
                        width: SCREEN_WIDTH,
                        height: SCREEN_HEIGHT,
                        borderRadius: 40,
                        objectFit: "cover",
                        display: "block",
                    }}
                />
            </div>
        </div>
    );
};
