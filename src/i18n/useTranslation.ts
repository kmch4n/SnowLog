import { useMemo, useSyncExternalStore } from "react";

import {
    getCurrentLocale,
    getCurrentPreference,
    getLocaleVersion,
    setLocalePreference,
    subscribeToLocale,
    t,
} from "./index";
import type { LocalePreference, SupportedLocale } from "./types";

interface UseTranslationReturn {
    t: (key: string, params?: Record<string, unknown>) => string;
    locale: SupportedLocale;
    preference: LocalePreference;
    setPreference: (next: LocalePreference) => Promise<void>;
}

/**
 * Read translations and the current locale.
 *
 * Components subscribe to a module-level version counter so they re-render
 * the moment any caller changes the language preference, even if they live
 * in a different navigation stack.
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
        preference: getCurrentPreference(),
        setPreference: setLocalePreference,
    };
}
