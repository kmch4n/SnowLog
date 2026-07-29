import { Config } from "@remotion/cli/config";

// PNG, not JPEG: every frame is encoded twice otherwise, once to a lossy
// intermediate and again by the codec. The ski footage is high-motion and
// showed the compounded loss.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setCrf(16);

// Concurrency is how many headless Chrome tabs render frames in parallel. The
// scaffold shipped 4, which left three quarters of this 8-core/16-thread
// machine idle and made a full render take over twenty minutes. Leaving a few
// threads free keeps the machine usable while a render runs.
Config.setConcurrency(12);

// Remotion defaults to software GL for deterministic output. The device frame
// animates a 3D transform on every frame, which is exactly the work a GPU is
// for. Drop back to "swangle" if a render ever differs between machines.
Config.setChromiumOpenGlRenderer("angle");
