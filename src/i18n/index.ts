import * as Localization from "expo-localization";
import { I18n } from "i18n-js";

import { en } from "./locales/en";
import { ja } from "./locales/ja";
import type { SupportedLocale } from "./types";

const i18n = new I18n({ ja, en });
i18n.enableFallback = true;
i18n.defaultLocale = "ja";

function detectDeviceLocale(): SupportedLocale {
    const code = Localization.getLocales()[0]?.languageCode ?? "ja";
    return code === "ja" ? "ja" : "en";
}

const currentLocale: SupportedLocale = detectDeviceLocale();
i18n.locale = currentLocale;

const listeners = new Set<() => void>();
const version = 0;

export function getCurrentLocale(): SupportedLocale {
    return currentLocale;
}

export function getLocaleVersion(): number {
    return version;
}

export function subscribeToLocale(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function t(
    key: string,
    params?: Record<string, unknown>
): string {
    return i18n.t(key, params);
}
