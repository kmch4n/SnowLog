import {
    Pressable,
    type GestureResponderEvent,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

import { PRESS_SCALE, SPRING_DEFAULT, SPRING_PRESS_IN } from "@/constants/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, "style"> {
    style?: StyleProp<ViewStyle>;
}

/**
 * Pressable with instant scale-down feedback on press-in (not on release),
 * per .memory/apple-design-rn.md. Springs are interruptible, so a quick
 * tap-and-cancel reverses smoothly from the current scale.
 *
 * Do not wrap surfaces that already have native press feedback
 * (e.g. GlassSurface with isInteractive, such as the FAB).
 */
export function PressableScale({
    style,
    onPressIn,
    onPressOut,
    ...rest
}: PressableScaleProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = (event: GestureResponderEvent) => {
        scale.value = withSpring(PRESS_SCALE, SPRING_PRESS_IN);
        onPressIn?.(event);
    };

    const handlePressOut = (event: GestureResponderEvent) => {
        scale.value = withSpring(1, SPRING_DEFAULT);
        onPressOut?.(event);
    };

    return (
        <AnimatedPressable
            {...rest}
            style={[style, animatedStyle]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        />
    );
}
