import {
    SymbolView,
    type AndroidSymbol,
    type SFSymbol,
    type SymbolWeight,
} from "expo-symbols";
import { Text, type StyleProp, type ViewStyle } from "react-native";

export interface IconName {
    ios: SFSymbol;
    android: AndroidSymbol;
    web: AndroidSymbol;
}

interface IconProps {
    name: IconName;
    size?: number;
    color?: string;
    weight?: SymbolWeight;
    fallback: string;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * Cross-platform icon wrapper around expo-symbols' SymbolView.
 *
 * iOS renders SF Symbols natively; Android and web render Material Symbols
 * via the @expo-google-fonts/material-symbols font that ships with
 * expo-symbols. The required `fallback` Unicode string is shown when the
 * symbol cannot be resolved on the current platform.
 */
export function Icon({
    name,
    size = 16,
    color,
    weight = "regular",
    fallback,
    accessibilityLabel,
    style,
}: IconProps) {
    return (
        <SymbolView
            name={name}
            size={size}
            tintColor={color}
            weight={weight}
            fallback={
                <Text
                    style={{
                        fontSize: size,
                        color,
                        lineHeight: size * 1.1,
                    }}
                >
                    {fallback}
                </Text>
            }
            accessibilityLabel={accessibilityLabel}
            style={style}
        />
    );
}
