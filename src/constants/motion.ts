import { LinearTransition, type WithSpringConfig } from "react-native-reanimated";

/**
 * Standard spring configs, following Apple's damping/response model
 * (see .memory/apple-design-rn.md). Use these instead of inline values.
 */

/** Critically damped: no overshoot. Default for all UI transitions. */
export const SPRING_DEFAULT: WithSpringConfig = {
    dampingRatio: 1,
    duration: 350,
};

/**
 * Slightly under-damped. Only for landings of momentum-carrying gestures
 * (flick, throw, drag release) — never for tap-triggered transitions.
 */
export const SPRING_MOMENTUM: WithSpringConfig = {
    dampingRatio: 0.8,
    duration: 350,
};

/**
 * Layout transition matching SPRING_DEFAULT, for views whose size or
 * position changes across renders. Replaces RN core's LayoutAnimation,
 * which ignores the system Reduce Motion setting.
 */
export const LAYOUT_SPRING = LinearTransition.springify(350).dampingRatio(1);

/** Near-instant settle for press-in feedback — response must feel immediate. */
export const SPRING_PRESS_IN: WithSpringConfig = {
    dampingRatio: 1,
    duration: 150,
};

/** Scale applied by PressableScale while pressed. */
export const PRESS_SCALE = 0.97;
