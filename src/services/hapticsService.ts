import * as Haptics from "expo-haptics";

/**
 * Fire a haptic without letting unhandled rejections bubble up.
 *
 * expo-haptics can throw `UnavailabilityError` when the native module
 * is not linked (e.g. when a dev client is running an older binary that
 * predates the dependency being added) or when the OS does not support
 * the requested feedback type. These are non-fatal for the caller.
 */
function safeFire(run: () => Promise<void>): void {
    try {
        run().catch(() => {});
    } catch {
        // swallow synchronous throws as well
    }
}

/**
 * Fire a light impact haptic. Use for lightweight affirmative actions
 * such as toggling favorite or releasing a pull-to-refresh.
 */
export function hapticLight(): void {
    safeFire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/**
 * Fire a medium impact haptic. Use for mode transitions such as
 * entering multi-select via long-press.
 */
export function hapticMedium(): void {
    safeFire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/**
 * Fire a selection haptic. Use for discrete picker or segment changes.
 */
export function hapticSelection(): void {
    safeFire(() => Haptics.selectionAsync());
}

/**
 * Fire a success notification haptic. Use when a multi-step user
 * operation finishes without issues.
 */
export function hapticSuccess(): void {
    safeFire(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    );
}

/**
 * Fire a warning notification haptic. Use for confirmed destructive
 * actions or operations that completed with partial errors.
 */
export function hapticWarning(): void {
    safeFire(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    );
}

/**
 * Fire an error notification haptic. Use when an operation fails.
 */
export function hapticError(): void {
    safeFire(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    );
}
