import type { IconName } from "@/components/ui/Icon";

/**
 * Centralized SF Symbol / Material Symbol name catalog used by the Icon
 * wrapper. Keeping definitions in one place prevents drift across surfaces
 * and gives every call site the same iOS / Android / web triplet.
 */
export const IconNames = {
    starFill: { ios: "star.fill", android: "star", web: "star" },
    starOutline: { ios: "star", android: "star_outline", web: "star_outline" },
    photo: { ios: "photo", android: "image", web: "image" },
    checkmark: { ios: "checkmark", android: "check", web: "check" },
    xmark: { ios: "xmark", android: "close", web: "close" },
    chevronLeft: {
        ios: "chevron.left",
        android: "chevron_left",
        web: "chevron_left",
    },
    chevronRight: {
        ios: "chevron.right",
        android: "chevron_right",
        web: "chevron_right",
    },
    trash: { ios: "trash", android: "delete", web: "delete" },
} as const satisfies Record<string, IconName>;
