import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption.tsx";
import { getScene, GRID_FRAME_COUNT } from "../script.ts";
import { Palette } from "../theme/colors.ts";

const COLUMNS = 6;
const ROWS = 8;
const TILE_WIDTH = 300;
const TILE_HEIGHT = 190;
const GAP = 18;

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const CAPTION_DELAY_IN_SECONDS = 0.5;
const CAPTION_STEP_IN_SECONDS = 0.9;

const tileSrc = (index: number): string => {
    const frameNumber = (index % GRID_FRAME_COUNT) + 1;
    return staticFile(`grid/frame-${String(frameNumber).padStart(2, "0")}.jpg`);
};

export const S02Grid: React.FC = () => {
    const scene = getScene("s02");
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    const scroll = interpolate(frame, [0, durationInFrames], [0, -900]);

    return (
        <AbsoluteFill style={{ backgroundColor: Palette.backdrop, overflow: "hidden" }}>
            <AbsoluteFill style={{ perspective: 1400, display: "grid", placeItems: "center" }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${COLUMNS}, ${TILE_WIDTH}px)`,
                        gap: GAP,
                        transform: `rotateX(38deg) rotateZ(-8deg) translateY(${scroll}px)`,
                        transformStyle: "preserve-3d",
                    }}
                >
                    {new Array(COLUMNS * ROWS).fill(true).map((_, index) => (
                        <Img
                            key={index}
                            src={tileSrc(index)}
                            style={{
                                width: TILE_WIDTH,
                                height: TILE_HEIGHT,
                                objectFit: "cover",
                                borderRadius: 10,
                                opacity: 0.55,
                            }}
                        />
                    ))}
                </div>
            </AbsoluteFill>

            {/* Darken the edges so the grid reads as endless. */}
            <AbsoluteFill
                style={{
                    background:
                        "linear-gradient(to bottom, rgba(10,25,41,0.95) 0%, rgba(10,25,41,0) 35%, rgba(10,25,41,0) 55%, rgba(10,25,41,0.98) 100%)",
                }}
            />
            <AbsoluteFill style={{ justifyContent: "flex-end", padding: 120, gap: 20 }}>
                {scene.captions.map((caption, index) => (
                    <Caption
                        key={caption}
                        text={caption}
                        delayInFrames={Math.round(
                            (CAPTION_DELAY_IN_SECONDS + index * CAPTION_STEP_IN_SECONDS) * fps,
                        )}
                    />
                ))}
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
