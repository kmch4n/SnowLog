import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";

import { db } from "@/database";
import migrations from "../../drizzle/migrations";

/**
 * ルートレイアウト
 * アプリ起動時にDBマイグレーションを実行してから画面を表示する
 */
export default function RootLayout() {
    const colorScheme = useColorScheme();
    const { success, error } = useMigrations(db, migrations);

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>DBの初期化に失敗しました</Text>
                <Text style={styles.errorDetail}>{error.message}</Text>
            </View>
        );
    }

    if (!success) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#1A3A5C" />
            </View>
        );
    }

    return (
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="video-import"
                    options={{
                        presentation: "modal",
                        title: "動画をインポート",
                        headerStyle: { backgroundColor: "#1A3A5C" },
                        headerTintColor: "#FFFFFF",
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="video/[id]"
                    options={{
                        title: "動画詳細",
                        headerStyle: { backgroundColor: "#1A3A5C" },
                        headerTintColor: "#FFFFFF",
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
            </Stack>
        </ThemeProvider>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
    },
    errorText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#E53935",
        marginBottom: 8,
    },
    errorDetail: {
        fontSize: 12,
        color: "#888888",
    },
});
