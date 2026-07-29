import { Video } from "@remotion/media";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const FADE_OUT_DURATION_IN_SECONDS = 0.5;

// The source runs 18.7s; this is where the strongest carving action starts.
const HERO_START_IN_SECONDS = 4;

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
                trimBefore={Math.round(HERO_START_IN_SECONDS * fps)}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Kept light. The heavy vignette and grain existed to disguise a
                720p upscale; the source is now native 1080p downsampled from 4K,
                so these are purely for mood. */}
            <AbsoluteFill
                style={{
                    background:
                        "radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(10,25,41,0.55) 100%)",
                }}
            />
            <AbsoluteFill
                style={{
                    opacity: 0.03,
                    backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")",
                }}
            />
        </AbsoluteFill>
    );
};
