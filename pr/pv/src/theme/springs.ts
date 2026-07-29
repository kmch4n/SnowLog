/** Smooth reveal without bounce. */
export const SPRING_SMOOTH = { damping: 200 } as const;

/** Snappy UI motion with minimal bounce. */
export const SPRING_SNAPPY = { damping: 20, stiffness: 200 } as const;

/** Playful entrance with visible bounce. */
export const SPRING_BOUNCY = { damping: 8 } as const;
