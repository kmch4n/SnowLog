import { AbsoluteFill, interpolate, random, useVideoConfig } from "remotion";
import { Palette } from "../../theme/colors.ts";

const FLAKE_COUNT = 220;

/**
 * A surge of snow that covers the frame and clears again.
 *
 * `progress` runs 0 -> 1 -> 0 across the cut: at 1 the veil is fully opaque, so
 * the cut underneath is hidden no matter how the flakes happen to land. The
 * flakes sell the motion; the veil does the actual covering.
 */
export const SnowWipe: React.FC<{ progress: number }> = ({ progress }) => {
    const { width, height } = useVideoConfig();

    // Stays clear for the first quarter, then closes fast and holds at full
    // opacity through the middle. Reaching 1 only at the exact peak left the
    // outgoing scene faintly visible under the veil at the cut, because with an
    // even frame count no frame lands exactly on the peak.
    const veil = interpolate(progress, [0.25, 0.8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
            {new Array(FLAKE_COUNT).fill(true).map((_, index) => {
                const seed = `wipe-${index}`;
                const size = 6 + random(`${seed}-size`) * 26;
                const lead = random(`${seed}-lead`) * 0.45;
                const drift = (random(`${seed}-drift`) - 0.5) * 260;

                // Each flake crosses the frame bottom-to-top on its own offset,
                // so the mass arrives as a wave rather than a solid block.
                const travel = interpolate(progress, [lead, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                });

                return (
                    <div
                        key={seed}
                        style={{
                            position: "absolute",
                            left: random(`${seed}-x`) * width + travel * drift,
                            top: interpolate(travel, [0, 1], [height + size, -size * 2]),
                            width: size,
                            height: size,
                            borderRadius: "50%",
                            backgroundColor: Palette.white,
                            opacity: Math.min(1, travel * 3) * (0.5 + random(`${seed}-a`) * 0.5),
                        }}
                    />
                );
            })}

            <AbsoluteFill
                style={{
                    background: `radial-gradient(circle at 50% 60%, ${Palette.snow} 0%, ${Palette.white} 70%)`,
                    opacity: veil,
                }}
            />
        </AbsoluteFill>
    );
};
