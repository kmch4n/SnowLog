import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SnowParticles } from "../components/SnowParticles.tsx";
import { getScene } from "../script.ts";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";
import { fontFamily } from "../theme/typography.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const RULE_DELAY_IN_SECONDS = 0.45;
const RULE_DURATION_IN_SECONDS = 0.9;

/**
 * The film used to open cold on a moving skier. This gives it a beat to start
 * from — black, a season card, then the cut into the run.
 *
 * There is deliberately no logo here: S3 is the logo moment, and showing it
 * twice would spend the reveal before it lands.
 */
export const S00Title: React.FC = () => {
    const scene = getScene("s00");
    const frame = useCurrentFrame();
    const { fps, width } = useVideoConfig();

    const rise = spring({ frame, fps, config: SPRING_SMOOTH });

    const ruleStart = Math.round(RULE_DELAY_IN_SECONDS * fps);
    const ruleEnd = ruleStart + Math.round(RULE_DURATION_IN_SECONDS * fps);
    const rule = interpolate(frame, [ruleStart, ruleEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill
            style={{
                backgroundColor: "#04070C",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 30,
            }}
        >
            <SnowParticles count={40} />

            {/* Every caption, not just the first. Indexing one out and ignoring
                the rest silently discarded a line added to the script, and no
                test caught it. */}
            {scene.captions.map((caption) => (
                <div
                    key={caption}
                    style={{
                        fontFamily,
                        color: Palette.snow,
                        fontSize: 78,
                        fontWeight: 700,
                        letterSpacing: "0.34em",
                        // Trailing letter-spacing pushes the text off-centre; the
                        // padding puts it back.
                        paddingLeft: "0.34em",
                        opacity: rise,
                        transform: `translateY(${(1 - rise) * 26}px)`,
                    }}
                >
                    {caption}
                </div>
            ))}

            <div
                style={{
                    width: rule * width * 0.22,
                    height: 2,
                    backgroundColor: Palette.gold,
                    opacity: 0.9,
                }}
            />
        </AbsoluteFill>
    );
};
