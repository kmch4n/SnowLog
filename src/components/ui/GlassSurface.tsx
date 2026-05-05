import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";

const GLASS_AVAILABLE = isLiquidGlassAvailable();

export type GlassVariant = "panel" | "toolbar" | "fab";

interface GlassSurfaceProps {
    variant: GlassVariant;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    isInteractive?: boolean;
    tintColor?: string;
}

const FALLBACK_BG: Record<GlassVariant, string> = {
    panel: Colors.freshSnow,
    toolbar: Colors.freshSnow,
    fab: Colors.alpineBlue,
};

/**
 * Liquid Glass surface wrapper.
 *
 * On iOS 26+ devices where the glass effect API is available, renders an
 * `expo-glass-effect` GlassView. On older iOS versions and on Android, falls
 * back to a plain View with the variant's opaque brand color so existing
 * surfaces stay readable.
 *
 * Web has its own .web.tsx shim that always renders the opaque fallback.
 */
export function GlassSurface({
    variant,
    style,
    children,
    isInteractive,
    tintColor,
}: GlassSurfaceProps) {
    if (GLASS_AVAILABLE) {
        const resolvedTint =
            tintColor ?? (variant === "fab" ? Colors.alpineBlue : undefined);
        return (
            <GlassView
                style={style}
                glassEffectStyle="regular"
                isInteractive={isInteractive ?? variant === "fab"}
                tintColor={resolvedTint}
            >
                {children}
            </GlassView>
        );
    }
    return (
        <View style={[{ backgroundColor: FALLBACK_BG[variant] }, style]}>
            {children}
        </View>
    );
}
