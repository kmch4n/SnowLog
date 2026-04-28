export type SupportedLocale = "ja" | "en";

export const SUPPORTED_LOCALES: SupportedLocale[] = ["ja", "en"];

export const DEVICE_LOCALE_VALUE = "device" as const;

export type LocalePreference = SupportedLocale | typeof DEVICE_LOCALE_VALUE;

export const LOCALE_PREFERENCE_KEY = "app_locale";
