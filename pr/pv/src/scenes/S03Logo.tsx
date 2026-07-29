import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SnowParticles } from "../components/SnowParticles.tsx";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const WIPE_DELAY_IN_SECONDS = 0.3;
const WIPE_DURATION_IN_SECONDS = 0.8;

export const S03Logo: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const iconIn = spring({ frame, fps, config: SPRING_SMOOTH });
    // The tagline is revealed by a mask that wipes across it.
    const wipeStartInFrames = Math.round(fps * WIPE_DELAY_IN_SECONDS);
    const wipeEndInFrames = wipeStartInFrames + Math.round(fps * WIPE_DURATION_IN_SECONDS);
    const wipe = interpolate(frame, [wipeStartInFrames, wipeEndInFrames], [0, 100], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: Palette.backdrop,
                display: "grid",
                placeItems: "center",
                gap: 48,
            }}
        >
            <SnowParticles count={70} />
            <Img
                src={staticFile("brand/icon.png")}
                style={{
                    width: 220,
                    height: 220,
                    borderRadius: 48,
                    opacity: iconIn,
                    transform: `scale(${0.85 + iconIn * 0.15})`,
                }}
            />
            <div
                style={{
                    fontFamily,
                    color: Palette.snow,
                    ...TYPE.hero,
                    WebkitMaskImage: `linear-gradient(to right, #000 ${wipe}%, transparent ${wipe}%)`,
                    maskImage: `linear-gradient(to right, #000 ${wipe}%, transparent ${wipe}%)`,
                }}
            >
                滑走動画を、練習ログへ。
            </div>
        </AbsoluteFill>
    );
};
