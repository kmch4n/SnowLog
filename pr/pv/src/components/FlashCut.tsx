import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const DEFAULT_DURATION_IN_SECONDS = 0.15;

export const FlashCut: React.FC<{ durationInSeconds?: number }> = ({
    durationInSeconds = DEFAULT_DURATION_IN_SECONDS,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const durationInFrames = Math.round(fps * durationInSeconds);
    const opacity = interpolate(frame, [0, durationInFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity, pointerEvents: "none" }} />
    );
};
