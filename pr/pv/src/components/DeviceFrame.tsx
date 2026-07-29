import { Video } from "@remotion/media";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// The screen recordings are 592x1280. Never let SCREEN_HEIGHT exceed that —
// upscaling a screen capture is immediately visible as mush.
const SCREEN_HEIGHT = 960;
const SCREEN_WIDTH = Math.round((SCREEN_HEIGHT * 592) / 1280);

const BEZEL = 11;
const SCREEN_RADIUS = 46;
const BODY_RADIUS = SCREEN_RADIUS + BEZEL;
const BODY_WIDTH = SCREEN_WIDTH + BEZEL * 2;

// Proportions taken from a modern iPhone: the island is roughly 28% of the
// screen width and sits just under the top bezel.
const ISLAND_WIDTH = Math.round(SCREEN_WIDTH * 0.28);
const ISLAND_HEIGHT = 34;
const ISLAND_TOP = 13;

const BUTTON_DEPTH = 3;

type SideButton = {
    side: "left" | "right";
    top: number;
    height: number;
};

const SIDE_BUTTONS: readonly SideButton[] = [
    { side: "left", top: 132, height: 30 },
    { side: "left", top: 196, height: 62 },
    { side: "left", top: 272, height: 62 },
    { side: "right", top: 226, height: 96 },
];

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
                    transform: `rotateY(${rotateY}deg)`,
                    transformStyle: "preserve-3d",
                    width: BODY_WIDTH,
                    padding: BEZEL,
                    borderRadius: BODY_RADIUS,
                    background: "linear-gradient(150deg, #3A4350 0%, #11161D 42%, #0A0D12 68%, #2B333E 100%)",
                    boxShadow: [
                        "0 2px 3px rgba(255,255,255,0.22) inset",
                        "0 -2px 3px rgba(0,0,0,0.5) inset",
                        "0 34px 60px rgba(0,0,0,0.55)",
                        "0 90px 140px rgba(0,0,0,0.45)",
                    ].join(", "),
                }}
            >
                {SIDE_BUTTONS.map((button) => (
                    <div
                        key={`${button.side}-${button.top}`}
                        style={{
                            position: "absolute",
                            [button.side]: -BUTTON_DEPTH,
                            top: button.top,
                            width: BUTTON_DEPTH + 2,
                            height: button.height,
                            borderRadius: 2,
                            background: "linear-gradient(180deg, #47505C 0%, #232A33 100%)",
                        }}
                    />
                ))}

                <div
                    style={{
                        position: "relative",
                        width: SCREEN_WIDTH,
                        height: SCREEN_HEIGHT,
                        borderRadius: SCREEN_RADIUS,
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
                            width: SCREEN_WIDTH,
                            height: SCREEN_HEIGHT,
                            objectFit: "cover",
                            display: "block",
                        }}
                    />

                    {/* Screen recordings capture the framebuffer, so the cutout
                        is absent from the source and has to be drawn back on. */}
                    <div
                        style={{
                            position: "absolute",
                            top: ISLAND_TOP,
                            left: (SCREEN_WIDTH - ISLAND_WIDTH) / 2,
                            width: ISLAND_WIDTH,
                            height: ISLAND_HEIGHT,
                            borderRadius: ISLAND_HEIGHT / 2,
                            backgroundColor: "#000000",
                        }}
                    />

                    {/* A faint diagonal sheen so the glass reads as glass. */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background:
                                "linear-gradient(122deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 66%, rgba(255,255,255,0.045) 100%)",
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
