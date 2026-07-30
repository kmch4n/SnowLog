import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../theme/colors.ts";
import { SPRING_SNAPPY } from "../theme/springs.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const SECONDS_PER_CHARACTER = 0.06;

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
                    frame: frame - delayInFrames - index * SECONDS_PER_CHARACTER * fps,
                    fps,
                    config: SPRING_SNAPPY,
                });

                const remaining = 1 - progress;

                return (
                    <span
                        key={`${character}-${index}`}
                        style={{
                            display: "inline-block",
                            opacity: progress,
                            // Rises, slides in from behind the previous letter,
                            // and resolves out of a blur, so the line arrives
                            // with some force rather than just fading up.
                            transform: [
                                `translateY(${remaining * 34}px)`,
                                `translateX(${remaining * -26}px)`,
                                `scale(${1 - remaining * 0.14})`,
                            ].join(" "),
                            filter: `blur(${remaining * 7}px)`,
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
