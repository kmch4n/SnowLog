import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

export const CountUp: React.FC<{
    to: number;
    delayInFrames?: number;
    suffix?: string;
}> = ({ to, delayInFrames = 0, suffix = "" }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const progress = spring({
        frame: frame - delayInFrames,
        fps,
        config: SPRING_SMOOTH,
        durationInFrames: Math.round(fps * 1.2),
    });

    return (
        <span
            style={{
                fontFamily,
                color: Palette.gold,
                fontVariantNumeric: "tabular-nums",
                ...TYPE.stat,
            }}
        >
            {Math.round(progress * to)}
            <span style={{ ...TYPE.label, color: Palette.textSecondary }}>{suffix}</span>
        </span>
    );
};
