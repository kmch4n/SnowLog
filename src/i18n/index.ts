import * as Localization from "expo-localization";
import { I18n } from "i18n-js";

import {
    getPreference,
    setPreference,
} from "@/database/repositories/appPreferenceRepository";

import { en } from "./locales/en";
import { ja } from "./locales/ja";
import {
    DEVICE_LOCALE_VALUE,
    LOCALE_PREFERENCE_KEY,
    type LocalePreference,
    type SupportedLocale,
} from "./types";

const i18n = new I18n({ ja, en });
i18n.enableFallback = true;
i18n.defaultLocale = "ja";

const listeners = new Set<() => void>();
let version = 0;
let currentLocale: SupportedLocale = detectDeviceLocale();
let currentPreference: LocalePreference = DEVICE_LOCALE_VALUE;

i18n.locale = currentLocale;

function detectDeviceLocale(): SupportedLocale {
    const code = Localization.getLocales()[0]?.languageCode ?? "ja";
    return code === "ja" ? "ja" : "en";
}

function resolvePreference(pref: LocalePreference): SupportedLocale {
    return pref === "ja" || pref === "en" ? pref : detectDeviceLocale();
}

function applyLocale(next: SupportedLocale): void {
    if (next === currentLocale) return;
    currentLocale = next;
    i18n.locale = next;
}

function notifyListeners(): void {
    version += 1;
    listeners.forEach((listener) => listener());
}

export function getCurrentLocale(): SupportedLocale {
    return currentLocale;
}

export function getCurrentPreference(): LocalePreference {
    return currentPreference;
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

export async function loadInitialLocale(): Promise<void> {
    try {
        const stored = await getPreference(LOCALE_PREFERENCE_KEY);
        const pref: LocalePreference =
            stored === "ja" || stored === "en"
                ? stored
                : DEVICE_LOCALE_VALUE;
        currentPreference = pref;
        applyLocale(resolvePreference(pref));
        notifyListeners();
    } catch {
        // fall back to detected device locale
    }
}

export async function setLocalePreference(next: LocalePreference): Promise<void> {
    await setPreference(LOCALE_PREFERENCE_KEY, next);
    currentPreference = next;
    applyLocale(resolvePreference(next));
    notifyListeners();
}
