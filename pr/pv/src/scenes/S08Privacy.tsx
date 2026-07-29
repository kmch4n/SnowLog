import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption.tsx";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";

const DOT_COUNT = 28;

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const PULL_DURATION_IN_SECONDS = 2.4;
const CAPTION_DELAY_IN_SECONDS = 2 / 3;

export const S08Privacy: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const pull = spring({
        frame,
        fps,
        config: SPRING_SMOOTH,
        durationInFrames: Math.round(fps * PULL_DURATION_IN_SECONDS),
    });

    return (
        <AbsoluteFill
            style={{ backgroundColor: Palette.backdrop, display: "grid", placeItems: "center" }}
        >
            {new Array(DOT_COUNT).fill(true).map((_, index) => {
                const angle = (index / DOT_COUNT) * Math.PI * 2;
                const startRadius = 420 + random(`dot-${index}`) * 260;
                const radius = interpolate(pull, [0, 1], [startRadius, 120]);

                return (
                    <div
                        key={index}
                        style={{
                            position: "absolute",
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            backgroundColor: Palette.primaryLight,
                            opacity: interpolate(pull, [0, 0.8, 1], [0.8, 0.8, 0]),
                            transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
                        }}
                    />
                );
            })}
            <Img
                src={staticFile("brand/icon.png")}
                style={{ width: 200, height: 200, borderRadius: 44 }}
            />
            <AbsoluteFill style={{ justifyContent: "flex-end", padding: 120 }}>
                <Caption
                    text="オフラインファースト"
                    delayInFrames={Math.round(CAPTION_DELAY_IN_SECONDS * fps)}
                    align="center"
                />
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
