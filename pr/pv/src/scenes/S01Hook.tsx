import { Video } from "@remotion/media";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const FADE_OUT_DURATION_IN_SECONDS = 0.5;

export const S01Hook: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    const fadeOutDurationInFrames = Math.round(fps * FADE_OUT_DURATION_IN_SECONDS);
    const fadeOut = interpolate(
        frame,
        [durationInFrames - fadeOutDurationInFrames, durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop, opacity: fadeOut }}>
            <Video
                src={staticFile("footage/run.mp4")}
                playbackRate={0.85}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Vignette and grain hide the 720p to 1080p upscale. */}
            <AbsoluteFill
                style={{
                    background:
                        "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(10,25,41,0.85) 100%)",
                }}
            />
            <AbsoluteFill
                style={{
                    opacity: 0.06,
                    backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")",
                }}
            />
        </AbsoluteFill>
    );
};
