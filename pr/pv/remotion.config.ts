import { Config } from "@remotion/cli/config";

// JPEG at quality 100, not PNG. The visible loss earlier came from JPEG's
// *default* quality of 80, not from JPEG itself — at 100 the intermediate is
// effectively lossless ahead of an H.264 CRF 16 encode, and it writes far
// faster than PNG's lossless compression, which was costing minutes per render.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(100);
Config.setCodec("h264");
Config.setCrf(16);

// setHardwareAcceleration("if-possible") used to sit here, and it never once
// took effect: ffmpeg's GPU encoders do not accept "crf", so every render
// printed "Hardware accelerated encoding disabled" and fell back to libx264.
// Removed rather than left as decoration. It would need a bitrate target
// instead of CRF, and giving up quality-per-bit control on the master to save
// under a minute of a five-minute render is the wrong way round -- frame
// rendering dominates, not encoding.

// Every scene decodes the same few source clips over and over. The default
// cache is far smaller than these files, so frames were being re-decoded
// constantly. 2 GiB comfortably holds the working set.
Config.setOffthreadVideoCacheSizeInBytes(2 * 1024 * 1024 * 1024);

// Concurrency is how many headless Chrome tabs render frames in parallel. The
// scaffold shipped 4, which left three quarters of this 8-core/16-thread
// machine idle and made a full render take over twenty minutes. Leaving a few
// threads free keeps the machine usable while a render runs.
Config.setConcurrency(12);

// Remotion defaults to software GL for deterministic output. The device frame
// animates a 3D transform on every frame, which is exactly the work a GPU is
// for. Drop back to "swangle" if a render ever differs between machines.
Config.setChromiumOpenGlRenderer("angle");
