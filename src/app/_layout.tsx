import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";

import { db } from "@/database";
import {
    getAllTechniqueOptions,
    insertTechniqueOption,
} from "@/database/repositories/techniqueOptionRepository";
import { DEFAULT_TECHNIQUE_OPTIONS } from "@/constants/techniques";
import migrations from "../../drizzle/migrations";

/** 初回起動時にデフォルトの滑走種別を登録する */
async function seedTechniqueOptions() {
    const existing = await getAllTechniqueOptions();
    if (existing.length > 0) return;
    for (const name of DEFAULT_TECHNIQUE_OPTIONS) {
        await insertTechniqueOption(name);
    }
}

/**
 * ルートレイアウト
 * アプリ起動時にDBマイグレーションを実行してから画面を表示する
 */
export default function RootLayout() {
    const colorScheme = useColorScheme();
    const { success, error } = useMigrations(db, migrations);

    useEffect(() => {
        if (success) {
            seedTechniqueOptions();
        }
    }, [success]);

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
                <Stack.Screen
                    name="settings/techniques"
                    options={{
                        title: "滑走種別の管理",
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
