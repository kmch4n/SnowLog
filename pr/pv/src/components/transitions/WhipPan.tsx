import { AbsoluteFill, interpolate } from "remotion";
import { Palette } from "../../theme/colors.ts";

/**
 * A hard sideways whip: the frame smears, a light streak rips across, and the
 * next scene is already there when it settles.
 *
 * `backdropFilter` blurs whatever the boundary overlay is sitting on top of, so
 * this genuinely smears both outgoing and incoming scenes rather than faking it
 * with a drawn gradient. `progress` runs 0 -> 1 -> 0 across the cut.
 */
export const WhipPan: React.FC<{ progress: number; direction?: 1 | -1 }> = ({
    progress,
    direction = 1,
}) => {
    const blur = interpolate(progress, [0, 1], [0, 46]);
    const streak = interpolate(progress, [0.35, 1], [0, 0.9], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const slide = interpolate(progress, [0, 1], [0, 55 * direction]);

    return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
            <AbsoluteFill
                style={{
                    backdropFilter: `blur(${blur}px)`,
                    WebkitBackdropFilter: `blur(${blur}px)`,
                }}
            />
            <AbsoluteFill
                style={{
                    transform: `translateX(${slide}%)`,
                    background: `linear-gradient(90deg, transparent 0%, ${Palette.primaryLight} 42%, ${Palette.white} 50%, ${Palette.primaryLight} 58%, transparent 100%)`,
                    opacity: streak,
                }}
            />
        </AbsoluteFill>
    );
};
