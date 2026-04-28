/**
 * Web用ルートレイアウト
 * expo-sqlite / Drizzle はブラウザ非対応のため、DBマイグレーションをスキップする
 */
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { Colors } from "@/constants/colors";
import { loadInitialLocale } from "@/i18n";
import { useTranslation } from "@/i18n/useTranslation";

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const { t } = useTranslation();

    useEffect(() => {
        loadInitialLocale().catch(() => {});
    }, []);

    return (
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="video-import"
                    options={{
                        presentation: "modal",
                        title: t("import.title"),
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="video/[id]"
                    options={{
                        title: t("videoDetail.title"),
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="settings/techniques"
                    options={{
                        title: t("settings.techniques.title"),
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="settings/favorite-resorts"
                    options={{
                        title: t("settings.favoriteResorts.title"),
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="settings/tags"
                    options={{
                        title: t("settings.tags.title"),
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="settings/calendar"
                    options={{
                        title: t("settings.calendar.title"),
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="settings/duplicate-candidates"
                    options={{
                        title: t("settings.duplicateCandidates.title"),
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="settings/language"
                    options={{
                        title: t("settings.language.title"),
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
            </Stack>
        </ThemeProvider>
    );
}
