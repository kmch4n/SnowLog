/**
 * Alpine Blue カラーパレット
 * コンセプト: 冬の早朝、ゲレンデに立った瞬間の空気感
 * 澄んだ空の深い青、雪原の青白い光、朝日の暖かいゴールド
 */
export const Colors = {
    // Primary — 冬の澄んだ空
    alpineBlue: "#1565C0",
    alpineBlueDark: "#0A1929",
    alpineBlueLight: "#DCEAF8",

    // Background — 雪原（はっきり青白く）
    glacierWhite: "#EBF1F7",
    freshSnow: "#F5F8FC",
    frostGray: "#E3EBF2",

    // Accent — 朝日
    morningGold: "#D4A843",

    // Text — 3段階
    textPrimary: "#0A1929",
    textSecondary: "#4A6178",
    textTertiary: "#8FA3B8",

    // Border — 寒色系
    border: "#C8D6E0",
    borderLight: "#DCE6EF",

    // Semantic — タグタイプ別
    tag: {
        technique: { bg: "#DCEAF8", text: "#1565C0" },
        skier: { bg: "#F3E5F5", text: "#6A1B9A" },
        custom: { bg: "#E8F5E9", text: "#2E7D32" },
    },

    // Status
    error: "#CC3333",
    success: "#2E7D32",

    // Overlay
    overlayDark: "rgba(0,0,0,0.6)",
    overlayLight: "rgba(0,0,0,0.4)",

    // Header — 冬の澄んだ空
    headerBg: "#1565C0",
    headerText: "#FFFFFF",
} as const;
