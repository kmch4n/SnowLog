/**
 * 滑走種別のプリセット定数
 */
export const TECHNIQUE_PRESETS = [
    "大回り",
    "小回り",
    "コブ",
    "フリー",
    "パウダー",
    "カービング",
    "ウェーデルン",
] as const;

export type TechniquePreset = (typeof TECHNIQUE_PRESETS)[number];
