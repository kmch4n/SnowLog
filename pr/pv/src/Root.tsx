import { AbsoluteFill, Composition } from "remotion";

const Placeholder: React.FC = () => {
    return <AbsoluteFill style={{ backgroundColor: "#0A1929" }} />;
};

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="SnowLogPv"
            component={Placeholder}
            durationInFrames={4680}
            fps={60}
            width={1920}
            height={1080}
        />
    );
};
