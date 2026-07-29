import { Config } from "@remotion/cli/config";

// PNG, not JPEG: every frame is encoded twice otherwise, once to a lossy
// intermediate and again by the codec. The ski footage is high-motion and
// showed the compounded loss.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setCrf(16);
Config.setConcurrency(4);
