import { AbsoluteFill, useVideoConfig } from "remotion";
import { CountUp } from "../components/CountUp.tsx";
import { DeviceFrame } from "../components/DeviceFrame.tsx";
import { ScreenScene } from "../components/ScreenScene.tsx";
import { Palette } from "../theme/colors.ts";
import { fontFamily, TYPE } from "../theme/typography.ts";

// Wall-clock, fps-independent: convert with `fps` at the use site, never hardcode a frame count.
const STATS = [
    { label: "滑走日数", to: 24, suffix: "日", delayInSeconds: 0.35 },
    { label: "ゲレンデ", to: 9, suffix: "ヶ所", delayInSeconds: 0.85 },
    { label: "動画", to: 312, suffix: "本", delayInSeconds: 1.35 },
] as const;

export const S07Dashboard: React.FC = () => {
    const { fps } = useVideoConfig();

    return (
        <ScreenScene eyebrow="SEASON" captions={["滑走日数 / ゲレンデ / テクニック"]}>
            <AbsoluteFill>
                <DeviceFrame src="screen/dashboard.mp4" tiltDegrees={5} />
                <AbsoluteFill
                    style={{
                        justifyContent: "flex-end",
                        alignItems: "center",
                        paddingBottom: 60,
                        gap: 8,
                    }}
                >
                    <div style={{ display: "flex", gap: 56 }}>
                        {STATS.map((stat) => (
                            <div key={stat.label} style={{ textAlign: "center" }}>
                                <CountUp
                                    to={stat.to}
                                    suffix={stat.suffix}
                                    delayInFrames={Math.round(stat.delayInSeconds * fps)}
                                />
                                <div
                                    style={{
                                        fontFamily,
                                        color: Palette.textSecondary,
                                        ...TYPE.label,
                                    }}
                                >
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </AbsoluteFill>
            </AbsoluteFill>
        </ScreenScene>
    );
};
