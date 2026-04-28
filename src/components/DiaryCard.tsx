import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import {
    SNOW_CONDITION_OPTIONS,
    WEATHER_OPTIONS,
} from "@/constants/diaryOptions";
import { useTranslation } from "@/i18n/useTranslation";
import type { DiaryEntry } from "@/types";

/** Parse snow_condition JSON string into string array (safe fallback) */
function parseSnowConditions(raw: string | null): string[] {
    if (raw == null) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [raw];
    } catch {
        return raw !== "" ? [raw] : [];
    }
}

interface DiaryCardProps {
    diary: DiaryEntry | null;
    onPress: () => void;
}

/**
 * Compact diary summary card displayed in the calendar day panel.
 * Shows a placeholder "add" button when no diary exists.
 */
export function DiaryCard({ diary, onPress }: DiaryCardProps) {
    const { t } = useTranslation();
    if (diary == null) {
        return (
            <TouchableOpacity
                style={styles.addButton}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <Text style={styles.addButtonText}>{t("diary.addButton")}</Text>
            </TouchableOpacity>
        );
    }

    const weatherOption = WEATHER_OPTIONS.find(
        (o) => o.value === diary.weather
    );
    const snowOptions = parseSnowConditions(diary.snowCondition)
        .map((v) => SNOW_CONDITION_OPTIONS.find((o) => o.value === v))
        .filter((o): o is (typeof SNOW_CONDITION_OPTIONS)[number] => o != null);

    const hasTopBadges = weatherOption != null || snowOptions.length > 0;

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {hasTopBadges && (
                <View style={styles.badgeRow}>
                    {weatherOption && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {weatherOption.icon
                                    ? `${weatherOption.icon} ${t(`diary.weather.${weatherOption.value}`)}`
                                    : t(`diary.weather.${weatherOption.value}`)}
                            </Text>
                        </View>
                    )}
                    {snowOptions.map((opt) => (
                        <View key={opt.value} style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {t(`diary.snow.${opt.value}`)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {diary.skiResortName != null && (
                <Text style={styles.resortName} numberOfLines={1}>
                    📍 {diary.skiResortName}
                </Text>
            )}

            {diary.impressions !== "" && (
                <Text style={styles.impressions} numberOfLines={2}>
                    {diary.impressions}
                </Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    addButton: {
        marginHorizontal: 16,
        marginVertical: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: Colors.border,
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
    },
    addButtonText: {
        fontSize: 14,
        color: Colors.alpineBlue,
        fontWeight: "600",
    },
    card: {
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: Colors.freshSnow,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
    },
    badgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    badge: {
        backgroundColor: Colors.frostGray,
        borderRadius: 100,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    badgeText: {
        fontSize: 12,
        color: Colors.textPrimary,
    },
    resortName: {
        marginTop: 6,
        fontSize: 13,
        color: Colors.textSecondary,
    },
    impressions: {
        marginTop: 6,
        fontSize: 13,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
});
