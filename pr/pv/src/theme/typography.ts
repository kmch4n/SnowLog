import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadNotoSansJp } from "@remotion/google-fonts/NotoSansJP";

const inter = loadInter("normal", { weights: ["400", "700"], subsets: ["latin"] });
const notoSansJp = loadNotoSansJp("normal", { weights: ["400", "700"] });

/** Latin first, Japanese fallback — matches pr/web/src/styles/global.css. */
export const fontFamily = `${inter.fontFamily}, ${notoSansJp.fontFamily}, sans-serif`;

export const TYPE = {
    hero: { fontSize: 96, fontWeight: 700, letterSpacing: "-0.02em" },
    caption: { fontSize: 56, fontWeight: 700, letterSpacing: "0.01em" },
    label: { fontSize: 32, fontWeight: 400, letterSpacing: "0.08em" },
    stat: { fontSize: 140, fontWeight: 700, letterSpacing: "-0.03em" },
} as const;
