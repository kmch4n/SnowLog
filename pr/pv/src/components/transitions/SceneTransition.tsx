import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../../theme/colors.ts";
import { SnowWipe } from "./SnowWipe.tsx";
import { WhipPan } from "./WhipPan.tsx";

export type TransitionKind = "snow" | "whip" | "flash";

/**
 * Rendered as an overlay straddling a scene boundary, never as a wrapper around
 * the scenes themselves.
 *
 * Remotion's `<TransitionSeries>` would be the obvious tool, but it *shortens*
 * the timeline by overlapping the scenes it joins. Scene lengths here come from
 * the measured narration audio, so anything that silently subtracts frames
 * breaks the one invariant the whole timeline rests on. An overlay costs
 * nothing: the total stays the plain sum of the scene durations.
 */
export const SceneTransition: React.FC<{ kind: TransitionKind; index: number }> = ({
    kind,
    index,
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // 0 at both ends, 1 at the cut itself, which is where the covering happens.
    const position = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);
    const progress = 1 - Math.abs(position * 2 - 1);

    if (kind === "snow") {
        return <SnowWipe progress={progress} />;
    }

    if (kind === "whip") {
        // Alternate the whip direction so consecutive ones do not feel like a
        // repeated tic.
        return <WhipPan progress={progress} direction={index % 2 === 0 ? 1 : -1} />;
    }

    return (
        <AbsoluteFill
            style={{
                backgroundColor: Palette.white,
                opacity: interpolate(progress, [0.4, 1], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                }),
                pointerEvents: "none",
            }}
        />
    );
};
