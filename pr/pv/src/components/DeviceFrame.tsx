import { Video } from "@remotion/media";
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Apple's official iPhone 17 Pro bezel, from the Product Bezels section of
 * developer.apple.com/design/resources.
 *
 * The screen rect below is not eyeballed — `scripts/make-screen-mask.py` reads
 * it out of the bezel's alpha channel and prints it on every asset build, so it
 * can be checked against these numbers. An earlier hand-measurement was wrong
 * by 15px at the top and bottom because it caught the Dynamic Island's hole
 * instead of the screen.
 */
const FRAME_ASPECT = 1350 / 2760;
const SCREEN_LEFT = 0.053333;
const SCREEN_TOP = 0.025;
const SCREEN_WIDTH = 0.893333;
const SCREEN_HEIGHT = 0.95;

/**
 * The recordings are 592x1280. Displaying the screen area at ~960px keeps it a
 * downscale; anything above 1280 would upscale a screen capture, which reads as
 * mush immediately.
 */
const SCREEN_DISPLAY_HEIGHT = 960;
const FRAME_HEIGHT = Math.round(SCREEN_DISPLAY_HEIGHT / SCREEN_HEIGHT);
const FRAME_WIDTH = Math.round(FRAME_HEIGHT * FRAME_ASPECT);

/**
 * Apple's screen corners are squircles, not circular arcs, so no CSS
 * border-radius clips the recording to them — the video kept poking out past
 * the phone at the corners. Masking with the bezel's own cutout is exact by
 * construction and survives swapping in a different device.
 */
const screenMask = {
    WebkitMaskImage: `url(${staticFile("brand/device-screen-mask.png")})`,
    maskImage: `url(${staticFile("brand/device-screen-mask.png")})`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
} as const;

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
                <div style={{ position: "absolute", inset: 0, ...screenMask }}>
                    <div
                        style={{
                            position: "absolute",
                            left: `${SCREEN_LEFT * 100}%`,
                            top: `${SCREEN_TOP * 100}%`,
                            width: `${SCREEN_WIDTH * 100}%`,
                            height: `${SCREEN_HEIGHT * 100}%`,
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
