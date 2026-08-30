import { useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Colors } from "@/constants/colors";
import { IconNames } from "@/constants/icons";
import { useTranslation } from "@/i18n/useTranslation";
import { ExportError } from "@/services/exportPayload";
import { exportAllToJSON } from "@/services/exportService";
import { ImportError } from "@/services/importPayload";
import { applyImportPlan, pickAndParseBackup } from "@/services/importJsonService";
import { hapticError, hapticSuccess, hapticWarning } from "@/services/hapticsService";
import { cleanupOrphanedFiles } from "@/services/orphanedFileCleanupService";

type SettingsRoute =
    | "/settings/calendar"
    | "/settings/techniques"
    | "/settings/favorite-resorts"
    | "/settings/tags"
    | "/settings/duplicate-candidates";

interface SettingsItem {
    label: string;
    description: string;
    route: SettingsRoute;
}

export default function SettingsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [isCleaning, setIsCleaning] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const items = useMemo<SettingsItem[]>(
        () => [
            {
                label: t("settings.menu.calendar"),
                description: t("settings.descriptions.calendar"),
                route: "/settings/calendar",
            },
            {
                label: t("settings.menu.techniques"),
                description: t("settings.descriptions.techniques"),
                route: "/settings/techniques",
            },
            {
                label: t("settings.menu.favoriteResorts"),
                description: t("settings.descriptions.favoriteResorts"),
                route: "/settings/favorite-resorts",
            },
            {
                label: t("settings.menu.tags"),
                description: t("settings.descriptions.tags"),
                route: "/settings/tags",
            },
            {
                label: t("settings.menu.duplicateCandidates"),
                description: t("settings.descriptions.duplicateCandidates"),
                route: "/settings/duplicate-candidates",
            },
        ],
        [t]
    );

    async function runExport(): Promise<void> {
        if (isExporting) return;
        setIsExporting(true);
        try {
            await exportAllToJSON();
            hapticSuccess();
        } catch (error) {
            hapticError();
            Alert.alert(
                t("settings.export.failed"),
                error instanceof ExportError
                    ? error.message
                    : t("settings.export.failedBody")
            );
        } finally {
            setIsExporting(false);
        }
    }

    function reportImportFailure(error: unknown): void {
        hapticError();
        Alert.alert(
            t("settings.import.failed"),
            error instanceof ImportError
                ? t(`settings.import.errors.${error.code}`)
                : t("settings.import.errors.writeFailed")
        );
    }

    async function writeImportPlan(plan: Parameters<typeof applyImportPlan>[0]): Promise<void> {
        setIsImporting(true);
        try {
            const summary = await applyImportPlan(plan);
            hapticSuccess();
            const body =
                summary.videosSkipped > 0
                    ? t("settings.import.completedWithSkipped", {
                        videos: summary.videos,
                        diary: summary.diaryEntries,
                        skipped: summary.videosSkipped,
                    })
                    : t("settings.import.completedBody", {
                        videos: summary.videos,
                        diary: summary.diaryEntries,
                    });
            const note =
                summary.unavailableVideos > 0
                    ? t("settings.import.unavailableNote", {
                        count: summary.unavailableVideos,
                    })
                    : "";
            Alert.alert(t("settings.import.completedTitle"), `${body}${note}`);
        } catch (error) {
            reportImportFailure(error);
        } finally {
            setIsImporting(false);
        }
    }

    /**
     * 取り込む前に件数を見せて確認を取る。書き込む量が大きく、
     * ファイルを選び間違えたときにもここで気づける。
     */
    async function runImport(): Promise<void> {
        if (isImporting) return;
        setIsImporting(true);
        let preview: Awaited<ReturnType<typeof pickAndParseBackup>>;
        try {
            preview = await pickAndParseBackup();
        } catch (error) {
            reportImportFailure(error);
            setIsImporting(false);
            return;
        } finally {
            setIsImporting(false);
        }

        // キャンセルは失敗ではないので何も出さない
        if (preview == null) return;

        if (preview.counts.videos === 0 && preview.counts.diaryEntries === 0) {
            Alert.alert(
                t("settings.import.nothingTitle"),
                t("settings.import.nothingBody")
            );
            return;
        }

        hapticWarning();
        Alert.alert(
            t("settings.import.confirmTitle"),
            t("settings.import.confirmBody", {
                videos: preview.counts.videos,
                diary: preview.counts.diaryEntries,
                tags: preview.counts.tags,
            }),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("settings.import.action"),
                    onPress: () => {
                        writeImportPlan(preview.plan).catch(() => {});
                    },
                },
            ]
        );
    }

    async function runManualCleanup(): Promise<void> {
        if (isCleaning) return;
        setIsCleaning(true);
        try {
            const result = await cleanupOrphanedFiles();
            hapticSuccess();
            Alert.alert(
                t("settings.storageCleanup.completedTitle"),
                result.deletedFiles > 0
                    ? t("settings.storageCleanup.completedBody", {
                        count: result.deletedFiles,
                    })
                    : t("settings.storageCleanup.noFilesBody")
            );
        } catch {
            hapticError();
            Alert.alert(
                t("settings.storageCleanup.failedTitle"),
                t("settings.storageCleanup.failedBody")
            );
        } finally {
            setIsCleaning(false);
        }
    }

    function confirmManualCleanup(): void {
        if (isCleaning) return;
        hapticWarning();
        Alert.alert(
            t("settings.storageCleanup.confirmTitle"),
            t("settings.storageCleanup.confirmBody"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("settings.storageCleanup.action"),
                    onPress: () => {
                        runManualCleanup().catch(() => {});
                    },
                },
            ]
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.section}>
                {items.map((item, index) => (
                    <TouchableOpacity
                        key={item.route}
                        style={[
                            styles.row,
                            index === 0 && styles.rowFirst,
                            index === items.length - 1 && styles.rowLast,
                        ]}
                        onPress={() => router.push(item.route as Href)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.rowContent}>
                            <Text style={styles.rowLabel}>{item.label}</Text>
                            <Text style={styles.rowDescription}>{item.description}</Text>
                        </View>
                        <Icon
                            name={IconNames.chevronRight}
                            size={22}
                            color={Colors.textTertiary}
                            weight="semibold"
                            fallback="›"
                            accessibilityLabel={t("a11y.iconNavigate")}
                            style={styles.chevron}
                        />
                    </TouchableOpacity>
                ))}
            </View>
            <View style={[styles.section, styles.dataSection]}>
                <TouchableOpacity
                    style={[
                        styles.row,
                        styles.rowFirst,
                        isExporting && styles.rowDisabled,
                    ]}
                    onPress={() => {
                        runExport().catch(() => {});
                    }}
                    activeOpacity={0.7}
                    disabled={isExporting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isExporting, busy: isExporting }}
                    accessibilityLabel={t("settings.menu.export")}
                >
                    <View style={styles.rowContent}>
                        <Text style={styles.rowLabel}>
                            {isExporting
                                ? t("settings.export.exporting")
                                : t("settings.menu.export")}
                        </Text>
                        <Text style={styles.rowDescription}>
                            {t("settings.descriptions.export")}
                        </Text>
                    </View>
                    <Icon
                        name={IconNames.share}
                        size={22}
                        color={Colors.textTertiary}
                        weight="semibold"
                        fallback="↑"
                        accessibilityLabel={t("settings.menu.export")}
                        style={styles.chevron}
                    />
                </TouchableOpacity>
            <TouchableOpacity
                    style={[
                        styles.row,
                        styles.rowLast,
                        isImporting && styles.rowDisabled,
                    ]}
                    onPress={() => {
                        runImport().catch(() => {});
                    }}
                    activeOpacity={0.7}
                    disabled={isImporting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isImporting, busy: isImporting }}
                    accessibilityLabel={t("settings.menu.import")}
                >
                    <View style={styles.rowContent}>
                        <Text style={styles.rowLabel}>
                            {isImporting
                                ? t("settings.import.importing")
                                : t("settings.menu.import")}
                        </Text>
                        <Text style={styles.rowDescription}>
                            {t("settings.descriptions.import")}
                        </Text>
                    </View>
                    <Icon
                        name={IconNames.restore}
                        size={22}
                        color={Colors.textTertiary}
                        weight="semibold"
                        fallback="↓"
                        accessibilityLabel={t("settings.menu.import")}
                        style={styles.chevron}
                    />
                </TouchableOpacity>
            </View>
            <View style={[styles.section, styles.maintenanceSection]}>
                <TouchableOpacity
                    style={[
                        styles.row,
                        styles.rowFirst,
                        styles.rowLast,
                        isCleaning && styles.rowDisabled,
                    ]}
                    onPress={confirmManualCleanup}
                    activeOpacity={0.7}
                    disabled={isCleaning}
                >
                    <View style={styles.rowContent}>
                        <Text style={styles.rowLabel}>
                            {isCleaning
                                ? t("settings.storageCleanup.cleaning")
                                : t("settings.menu.storageCleanup")}
                        </Text>
                        <Text style={styles.rowDescription}>
                            {t("settings.descriptions.storageCleanup")}
                        </Text>
                    </View>
                    <Icon
                        name={IconNames.trash}
                        size={22}
                        color={Colors.textTertiary}
                        weight="semibold"
                        fallback="×"
                        accessibilityLabel={t("settings.menu.storageCleanup")}
                        style={styles.chevron}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
        padding: 16,
    },
    section: {
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Colors.border,
    },
    dataSection: {
        marginTop: 16,
    },
    maintenanceSection: {
        marginTop: 16,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    rowDisabled: {
        opacity: 0.6,
    },
    rowFirst: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    rowLast: {
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    rowContent: {
        flex: 1,
    },
    rowLabel: {
        fontSize: 16,
        color: Colors.textPrimary,
    },
    rowDescription: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    chevron: {
        marginLeft: 8,
    },
});
