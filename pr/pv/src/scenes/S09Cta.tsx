import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SnowParticles } from "../components/SnowParticles.tsx";
import { getScene } from "../script.ts";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const BADGE_DELAY_IN_SECONDS = 0.4;

export const S09Cta: React.FC = () => {
    const scene = getScene("s09");
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const badgeIn = spring({
        frame: frame - Math.round(BADGE_DELAY_IN_SECONDS * fps),
        fps,
        config: SPRING_SMOOTH,
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: Palette.backdrop,
                display: "grid",
                placeItems: "center",
                gap: 36,
            }}
        >
            <SnowParticles count={60} />
            <Img
                src={staticFile("brand/icon.png")}
                style={{ width: 180, height: 180, borderRadius: 40 }}
            />
            <div style={{ fontFamily, color: Palette.snow, ...TYPE.hero }}>SnowLog</div>
            <Img
                src={staticFile("brand/app-store-badge.svg")}
                style={{
                    width: 320,
                    opacity: badgeIn,
                    transform: `translateY(${(1 - badgeIn) * 24}px)`,
                }}
            />
            {scene.captions.map((caption) => (
                <div
                    key={caption}
                    style={{ fontFamily, color: Palette.textSecondary, ...TYPE.label }}
                >
                    {caption}
                </div>
            ))}
        </AbsoluteFill>
    );
};
