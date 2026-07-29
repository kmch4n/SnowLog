import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";

export const SnowParticles: React.FC<{ count?: number }> = ({ count = 90 }) => {
    const frame = useCurrentFrame();
    const { width, height, fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
            {new Array(count).fill(true).map((_, index) => {
                const seed = `snow-${index}`;
                const size = 2 + random(`${seed}-size`) * 5;
                const speed = 40 + random(`${seed}-speed`) * 90;
                const drift = (random(`${seed}-drift`) - 0.5) * 120;
                const seconds = frame / fps;
                const startY = random(`${seed}-y`) * height;

                return (
                    <div
                        key={seed}
                        style={{
                            position: "absolute",
                            left: random(`${seed}-x`) * width + Math.sin(seconds) * drift,
                            top: (startY + seconds * speed) % height,
                            width: size,
                            height: size,
                            borderRadius: "50%",
                            backgroundColor: "#FFFFFF",
                            opacity: 0.15 + random(`${seed}-opacity`) * 0.4,
                        }}
                    />
                );
            })}
        </AbsoluteFill>
    );
};
