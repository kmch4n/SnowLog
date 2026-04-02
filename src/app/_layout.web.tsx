/**
 * Web用ルートレイアウト
 * expo-sqlite / Drizzle はブラウザ非対応のため、DBマイグレーションをスキップする
 */
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

import { Colors } from "@/constants/colors";

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="video-import"
                    options={{
                        presentation: "modal",
                        title: "動画をインポート",
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="video/[id]"
                    options={{
                        title: "動画詳細",
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="settings/calendar"
                    options={{
                        title: "カレンダー設定",
                        headerStyle: { backgroundColor: Colors.headerBg },
                        headerTintColor: Colors.headerText,
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
            </Stack>
        </ThemeProvider>
    );
}
