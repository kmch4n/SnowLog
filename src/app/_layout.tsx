import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, InteractionManager, StyleSheet, Text, useColorScheme, View } from "react-native";

import { ThumbnailMigrationScreen } from "@/components/ThumbnailMigrationScreen";
import { Colors } from "@/constants/colors";
import { db } from "@/database";
import {
    getPreference,
    setPreference,
} from "@/database/repositories/appPreferenceRepository";
import {
    getAllTechniqueOptions,
    insertTechniqueOption,
} from "@/database/repositories/techniqueOptionRepository";
import {
    getAllVideos,
    getVideosWithSuspiciousCapturedAt,
    updateVideoCapturedAt,
} from "@/database/repositories/videoRepository";
import { loadInitialLocale } from "@/i18n";
import { useTranslation } from "@/i18n/useTranslation";
import { getAssetInfo, isSyntheticAssetId } from "@/services/mediaService";
import {
    isThumbnailMigrationNeeded,
    runThumbnailMigration,
} from "@/services/thumbnailMigrationService";
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
 *
 * Repair strategy:
 *   - First launch (no stored version): full scan over all videos, comparing
 *     capturedAt against MediaLibrary creationTime. Fixes NaN/0/null and
 *     Date.now()-based values (> 1 hour drift). Stores REPAIR_VERSION afterward.
 *   - Subsequent launches (version matches): fast path — only queries rows
 *     with capturedAt <= MIN_VALID_TIMESTAMP (obviously invalid). Already-
 *     repaired datasets skip the scan entirely.
 *
 * Bump REPAIR_VERSION whenever the repair logic changes materially so that
 * existing users get one fresh full scan.
 */
const MIN_VALID_TIMESTAMP = 946684800; // 2000-01-01 UTC (seconds)
const REPAIR_VERSION = "1";
const REPAIR_VERSION_KEY = "capturedAt_repair_version";

async function repairInvalidCapturedAt() {
    try {
        const storedVersion = await getPreference(REPAIR_VERSION_KEY);
        const needsFullScan = storedVersion !== REPAIR_VERSION;

        // Fast path: only fetch obviously-invalid rows when full scan is done
        const targets = needsFullScan
            ? await getAllVideos()
            : await getVideosWithSuspiciousCapturedAt(MIN_VALID_TIMESTAMP);

        // Nothing to repair — record version and bail out
        if (targets.length === 0) {
            if (needsFullScan) {
                await setPreference(REPAIR_VERSION_KEY, REPAIR_VERSION);
            }
            return;
        }

        for (const video of targets) {
            try {
                if (isSyntheticAssetId(video.assetId)) continue;
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
            } catch {
                // iCloud-only assets or metadata failures — skip silently
            }
        }

        if (needsFullScan) {
            await setPreference(REPAIR_VERSION_KEY, REPAIR_VERSION);
        }
    } catch {
        // DB access failures must not block app startup
    }
}

type ThumbnailMigrationPhase = "pending" | "running" | "done";

/**
 * ルートレイアウト
 * アプリ起動時にDBマイグレーションとサムネイル修復を実行してから画面を表示する。
 * サムネイル修復はアップデート後の初回起動時のみ走り、専用ロード画面を表示する。
 */
export default function RootLayout() {
    const colorScheme = useColorScheme();
    const { t } = useTranslation();
    const { success, error } = useMigrations(db, migrations);
    const [localeReady, setLocaleReady] = useState(false);
    const [thumbnailPhase, setThumbnailPhase] =
        useState<ThumbnailMigrationPhase>("pending");
    const [thumbnailProgress, setThumbnailProgress] = useState({
        processed: 0,
        total: 0,
    });

    useEffect(() => {
        if (!success) return;
        seedTechniqueOptions().catch(() => {});

        let cancelled = false;
        (async () => {
            try {
                await loadInitialLocale();
                if (cancelled) return;
                setLocaleReady(true);

                const needed = await isThumbnailMigrationNeeded();
                if (cancelled) return;
                if (!needed) {
                    setThumbnailPhase("done");
                    return;
                }
                setThumbnailPhase("running");
                await runThumbnailMigration((progress) => {
                    if (!cancelled) setThumbnailProgress(progress);
                });
            } catch {
                // Never let migration failure hard-block the app — proceed to UI
            } finally {
                if (!cancelled) setLocaleReady(true);
                if (!cancelled) setThumbnailPhase("done");
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [success]);

    useEffect(() => {
        if (thumbnailPhase !== "done") return;
        // Defer capturedAt repair until after the app is interactive
        const task = InteractionManager.runAfterInteractions(() => {
            repairInvalidCapturedAt().catch(() => {});
        });
        return () => task.cancel();
    }, [thumbnailPhase]);

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{t("errors.dbInitFailed")}</Text>
                <Text style={styles.errorDetail}>{error.message}</Text>
            </View>
        );
    }

    if (!success || !localeReady) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.alpineBlue} />
            </View>
        );
    }

    if (thumbnailPhase === "running") {
        return (
            <ThumbnailMigrationScreen
                processed={thumbnailProgress.processed}
                total={thumbnailProgress.total}
            />
        );
    }

    if (thumbnailPhase === "pending") {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.alpineBlue} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
                <Stack>
                    <Stack.Screen
                        name="(tabs)"
                        options={{
                            headerShown: false,
                            title: t("common.back"),
                        }}
                    />
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
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
    },
    errorText: {
        fontSize: 16,
        fontWeight: "700",
        color: Colors.error,
        marginBottom: 8,
    },
    errorDetail: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
});
