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
import { getAllVideos, updateVideoCapturedAt } from "@/database/repositories/videoRepository";
import { getAssetInfo } from "@/services/mediaService";
import { DEFAULT_TECHNIQUE_OPTIONS } from "@/constants/techniques";
import migrations from "../../drizzle/migrations";

/** デフォルトの滑走種別を登録する（差分シード：未登録の項目のみ追加） */
async function seedTechniqueOptions() {
    const existing = await getAllTechniqueOptions();
    const existingNames = new Set(existing.map((o) => o.name));
    for (const name of DEFAULT_TECHNIQUE_OPTIONS) {
        if (!existingNames.has(name)) {
            await insertTechniqueOption(name);
        }
    }
}

/**
 * capturedAt が不正なレコードを修復する
 * NaN/0/null だけでなく、Date.now()（インポート時刻）で保存されたレコードも対象。
 * MediaLibrary の creationTime と比較し、1時間以上乖離していれば修復する。
 * 冪等: 修復済みレコードは correctAt と一致するためスキップされる。
 */
const MIN_VALID_TIMESTAMP = 946684800; // 2000-01-01 UTC（秒）
async function repairInvalidCapturedAt() {
    const allVideos = await getAllVideos();
    for (const video of allVideos) {
        const info = await getAssetInfo(video.assetId, { shouldDownloadFromNetwork: false });
        if (!info?.creationTime || !Number.isFinite(info.creationTime)) continue;

        const correctAt = Math.floor(info.creationTime / 1000);
        if (correctAt <= MIN_VALID_TIMESTAMP) continue;

        const needsRepair = !Number.isFinite(video.capturedAt)
            || video.capturedAt <= MIN_VALID_TIMESTAMP
            || Math.abs(video.capturedAt - correctAt) > 3600;

        if (needsRepair) {
            await updateVideoCapturedAt(video.id, correctAt);
        }
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
            repairInvalidCapturedAt();
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
                <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "戻る" }} />
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
                <Stack.Screen
                    name="settings/favorite-resorts"
                    options={{
                        title: "お気に入りスキー場",
                        headerStyle: { backgroundColor: "#1A3A5C" },
                        headerTintColor: "#FFFFFF",
                        headerTitleStyle: { fontWeight: "700" },
                    }}
                />
                <Stack.Screen
                    name="settings/tags"
                    options={{
                        title: "タグの管理",
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
