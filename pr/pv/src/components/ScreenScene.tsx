import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "./Caption.tsx";
import { Palette } from "../theme/colors.ts";
import { SPRING_SMOOTH } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const CAPTION_BASE_DELAY_IN_SECONDS = 0.35;
const CAPTION_STEP_IN_SECONDS = 0.7;
const DEVICE_ENTER_IN_SECONDS = 0.8;
const DEVICE_EXIT_IN_SECONDS = 0.55;

export const ScreenScene: React.FC<{
    eyebrow?: string;
    captions: readonly string[];
    /** Which side the phone flies in from. Alternated scene to scene. */
    enterFrom?: 1 | -1;
    children: React.ReactNode;
}> = ({ eyebrow, captions, enterFrom = 1, children }) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    // The entrance lives here rather than in DeviceFrame because S04 and S06
    // split their phone across several <Series.Sequence> clips — inside
    // DeviceFrame the local frame restarts per clip, and the phone would fly in
    // again on every cut within the scene.
    const enter = spring({
        frame,
        fps,
        config: SPRING_SMOOTH,
        durationInFrames: Math.round(fps * DEVICE_ENTER_IN_SECONDS),
    });
    const exitStart = durationInFrames - Math.round(fps * DEVICE_EXIT_IN_SECONDS);
    const exit = spring({
        frame: frame - exitStart,
        fps,
        config: SPRING_SMOOTH,
        durationInFrames: Math.round(fps * DEVICE_EXIT_IN_SECONDS),
    });

    // -1 while arriving, 0 while settled, +1 while leaving.
    const travel = exit - (1 - enter);

    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    alignItems: "center",
                    height: "100%",
                    padding: "0 120px",
                }}
            >
                <div style={{ display: "grid", gap: 28 }}>
                    {eyebrow === undefined ? null : (
                        <div style={{ fontFamily, color: Palette.gold, ...TYPE.label }}>
                            {eyebrow}
                        </div>
                    )}
                    {captions.map((caption, index) => (
                        <Caption
                            key={caption}
                            text={caption}
                            delayInFrames={Math.round(
                                (CAPTION_BASE_DELAY_IN_SECONDS + index * CAPTION_STEP_IN_SECONDS) * fps,
                            )}
                        />
                    ))}
                </div>
                {/* `position: relative` is load-bearing. Remotion's <Series.Sequence>
                    and <AbsoluteFill> position themselves against the nearest
                    positioned ancestor; without it they escape this column and
                    anchor to the 1920x1080 scene root, painting over the copy. */}
                <div
                    style={{
                        position: "relative",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        perspective: 2200,
                        transform: [
                            `translateX(${travel * 620 * enterFrom}px)`,
                            `rotateY(${travel * 26 * enterFrom}deg)`,
                            `scale(${1 - Math.abs(travel) * 0.12})`,
                        ].join(" "),
                        opacity: 1 - Math.abs(travel) * 0.85,
                    }}
                >
                    {children}
                </div>
            </div>
        </AbsoluteFill>
    );
};
