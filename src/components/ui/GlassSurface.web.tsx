import { View, type StyleProp, type ViewStyle } from "react-native";

import { Colors } from "@/constants/colors";

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

/** Web shim — expo-glass-effect has no web implementation, always render opaque fallback. */
export function GlassSurface({ variant, style, children }: GlassSurfaceProps) {
    return (
        <View style={[{ backgroundColor: FALLBACK_BG[variant] }, style]}>
            {children}
        </View>
    );
}
