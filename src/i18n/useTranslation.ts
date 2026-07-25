import { getCurrentLocale, t } from "./index";
import type { SupportedLocale } from "./types";

interface UseTranslationReturn {
    t: (key: string, params?: Record<string, unknown>) => string;
    locale: SupportedLocale;
}

/**
 * Read translations and the current locale.
 *
 * The locale is resolved once from the device language at module init and never
 * changes while the app runs, so there is nothing to subscribe to. Users switch
 * language through iOS Settings, which restarts the app.
 */
export function useTranslation(): UseTranslationReturn {
    return {
        t,
        locale: getCurrentLocale(),
    };
}
