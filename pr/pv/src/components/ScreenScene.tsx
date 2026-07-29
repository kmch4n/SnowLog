import { AbsoluteFill, useVideoConfig } from "remotion";
import { Caption } from "./Caption.tsx";
import { Palette } from "../theme/colors.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const CAPTION_BASE_DELAY_IN_SECONDS = 0.35;
const CAPTION_STEP_IN_SECONDS = 0.7;

export const ScreenScene: React.FC<{
    eyebrow: string;
    captions: readonly string[];
    children: React.ReactNode;
}> = ({ eyebrow, captions, children }) => {
    const { fps } = useVideoConfig();

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
                    <div style={{ fontFamily, color: Palette.gold, ...TYPE.label }}>
                        {eyebrow}
                    </div>
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
                <div style={{ height: "100%" }}>{children}</div>
            </div>
        </AbsoluteFill>
    );
};
