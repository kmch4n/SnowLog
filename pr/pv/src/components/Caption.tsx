import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";
import { SPRING_SNAPPY } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

const FRAMES_PER_CHARACTER = 2;

export const Caption: React.FC<{
    text: string;
    delayInFrames?: number;
    align?: "left" | "center";
}> = ({ text, delayInFrames = 0, align = "left" }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    return (
        <div
            style={{
                display: "flex",
                justifyContent: align === "center" ? "center" : "flex-start",
                fontFamily,
                color: Palette.snow,
                ...TYPE.caption,
            }}
        >
            {Array.from(text).map((character, index) => {
                const progress = spring({
                    frame: frame - delayInFrames - index * FRAMES_PER_CHARACTER,
                    fps,
                    config: SPRING_SNAPPY,
                });

                return (
                    <span
                        key={`${character}-${index}`}
                        style={{
                            display: "inline-block",
                            opacity: progress,
                            transform: `translateY(${(1 - progress) * 28}px)`,
                            whiteSpace: "pre",
                        }}
                    >
                        {character}
                    </span>
                );
            })}
        </div>
    );
};
