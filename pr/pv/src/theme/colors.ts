/**
 * Mirrors src/constants/colors.ts of the SnowLog app.
 * Copied rather than imported: crossing project boundaries would complicate
 * the tsconfig for values that almost never change. Keep in sync by hand.
 */
export const Palette = {
    backdrop: "#0A1929",
    primary: "#1565C0",
    primaryLight: "#DCEAF8",
    snow: "#EBF1F7",
    gold: "#D4A843",
    textSecondary: "#4A6178",
    white: "#FFFFFF",
} as const;
