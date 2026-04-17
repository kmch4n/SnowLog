import { useRouter } from "expo-router";
import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

/** 左→右のタブ順序。`(tabs)/_layout.tsx` の NativeTabs 定義順と必ず一致させる。 */
const TAB_PATHS = [
    "/(tabs)",
    "/(tabs)/dashboard",
    "/(tabs)/calendar",
    "/(tabs)/search",
    "/(tabs)/settings",
] as const;

/** 横スワイプをタブ切替と認識する最小距離 (px)。画面幅の ~20% 目安。 */
const SWIPE_DISTANCE_THRESHOLD = 80;
/** 短距離でも fling 的に速いときは切替を許可する速度 (px/s)。 */
const SWIPE_VELOCITY_THRESHOLD = 500;
/** 横に 20px 動くまでは pan を activate せず、子の横スクロールに譲る。 */
const ACTIVE_OFFSET_X = 20;
/** 縦 15px を超えたら pan を fail させ、縦スクロールを優先する。 */
const FAIL_OFFSET_Y = 15;

interface SwipeableTabWrapperProps {
    tabIndex: number;
    children: ReactNode;
    style?: ViewStyle | ViewStyle[];
}

/**
 * タブ画面のルートをラップし、左右スワイプで隣接タブに遷移させる。
 *
 * 子の横 ScrollView は gesture-handler デフォルトで子側が勝つため、
 * FilterBar / SeasonSelector / favorites 等の横スクロール中は発火しない。
 * activeOffsetX / failOffsetY で誤発火を抑止し、縦スクロール開始時は譲る。
 */
export function SwipeableTabWrapper({
    tabIndex,
    children,
    style,
}: SwipeableTabWrapperProps) {
    const router = useRouter();

    const navigateToTab = (nextIndex: number) => {
        if (nextIndex < 0 || nextIndex >= TAB_PATHS.length) return;
        router.navigate(TAB_PATHS[nextIndex] as never);
    };

    const pan = Gesture.Pan()
        .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
        .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
        .onEnd((event) => {
            "worklet";
            const { translationX, velocityX } = event;
            const swipeLeft =
                translationX < -SWIPE_DISTANCE_THRESHOLD ||
                velocityX < -SWIPE_VELOCITY_THRESHOLD;
            const swipeRight =
                translationX > SWIPE_DISTANCE_THRESHOLD ||
                velocityX > SWIPE_VELOCITY_THRESHOLD;
            if (swipeLeft) {
                runOnJS(navigateToTab)(tabIndex + 1);
            } else if (swipeRight) {
                runOnJS(navigateToTab)(tabIndex - 1);
            }
        });

    return (
        <GestureDetector gesture={pan}>
            <View style={[styles.root, style]}>{children}</View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
});
