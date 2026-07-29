import { Video } from "@remotion/media";
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Apple's official iPhone 17 Pro bezel, from the Product Bezels section of
 * developer.apple.com/design/resources. The PNG is 1350x2760 with the screen
 * and the Dynamic Island punched out as transparency, so the frame itself masks
 * the recording's corners and draws the island — no CSS approximation needed.
 *
 * The screen rect was measured from the alpha channel rather than guessed:
 * 1206x2593 at (72, 84). Keeping these as fractions means the frame can be
 * displayed at any size without the video drifting out of the cutout.
 */
const FRAME_ASPECT = 1350 / 2760;
const SCREEN_LEFT = 72 / 1350;
const SCREEN_TOP = 84 / 2760;
const SCREEN_WIDTH = 1206 / 1350;
const SCREEN_HEIGHT = 2593 / 2760;

/**
 * The recordings are 592x1280. Displaying the screen area at 960px keeps it a
 * downscale; anything above 1280 would upscale a screen capture, which reads as
 * mush immediately.
 */
const SCREEN_DISPLAY_HEIGHT = 960;
const FRAME_HEIGHT = Math.round(SCREEN_DISPLAY_HEIGHT / SCREEN_HEIGHT);
const FRAME_WIDTH = Math.round(FRAME_HEIGHT * FRAME_ASPECT);

export const DeviceFrame: React.FC<{
    src: string;
    trimBefore?: number;
    trimAfter?: number;
    tiltDegrees?: number;
    playbackRate?: number;
}> = ({ src, trimBefore, trimAfter, tiltDegrees = 8, playbackRate }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // Slow drift so the frame never sits perfectly still.
    const rotateY = interpolate(frame, [0, durationInFrames], [tiltDegrees, -tiltDegrees]);

    return (
        <div
            style={{
                perspective: 2000,
                display: "grid",
                placeItems: "center",
                height: "100%",
                // Keeps the frame centred even when a parent lays its children
                // out as a flex row, which <Series.Sequence> does.
                width: "100%",
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: FRAME_WIDTH,
                    height: FRAME_HEIGHT,
                    transform: `rotateY(${rotateY}deg)`,
                    transformStyle: "preserve-3d",
                    filter: "drop-shadow(0 34px 60px rgba(0,0,0,0.55)) drop-shadow(0 90px 140px rgba(0,0,0,0.4))",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: `${SCREEN_LEFT * 100}%`,
                        top: `${SCREEN_TOP * 100}%`,
                        width: `${SCREEN_WIDTH * 100}%`,
                        height: `${SCREEN_HEIGHT * 100}%`,
                        overflow: "hidden",
                        backgroundColor: "#000000",
                    }}
                >
                    <Video
                        src={staticFile(src)}
                        trimBefore={trimBefore}
                        trimAfter={trimAfter}
                        playbackRate={playbackRate}
                        muted
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                </div>

                <Img
                    src={staticFile("brand/device-frame.png")}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                    }}
                />
            </div>
        </div>
    );
};
