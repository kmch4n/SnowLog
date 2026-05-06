import { useMemo, useSyncExternalStore } from "react";

import {
    getCurrentLocale,
    getLocaleVersion,
    subscribeToLocale,
    t,
} from "./index";
import type { SupportedLocale } from "./types";

interface UseTranslationReturn {
    t: (key: string, params?: Record<string, unknown>) => string;
    locale: SupportedLocale;
}

/**
 * Read translations and the current locale.
 *
 * The locale is resolved once from the device language at module init. The
 * subscription plumbing is kept so callers can re-render if a future change
 * surface needs to push locale updates.
 */
export function useTranslation(): UseTranslationReturn {
    const version = useSyncExternalStore(
        subscribeToLocale,
        getLocaleVersion,
        getLocaleVersion
    );
    const translate = useMemo(() => {
        void version;
        return (key: string, params?: Record<string, unknown>) => t(key, params);
    }, [version]);

    return {
        t: translate,
        locale: getCurrentLocale(),
    };
}
