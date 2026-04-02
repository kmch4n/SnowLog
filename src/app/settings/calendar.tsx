import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useAppPreference } from "@/hooks/useAppPreference";
import type { WeekStartDay } from "@/types";

const OPTIONS: { value: WeekStartDay; label: string }[] = [
    { value: "monday", label: "月曜日" },
    { value: "sunday", label: "日曜日" },
];

/**
 * カレンダー設定画面
 * 週の開始曜日を切り替える
 */
export default function CalendarSettingsScreen() {
    const [weekStartDay, setWeekStartDay] = useAppPreference(
        "weekStartDay",
        "monday"
    );

    return (
        <View style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>週の開始曜日</Text>
                <View style={styles.segmentRow}>
                    {OPTIONS.map((opt) => {
                        const isActive = weekStartDay === opt.value;
                        return (
                            <TouchableOpacity
                                key={opt.value}
                                style={[
                                    styles.segment,
                                    isActive && styles.segmentActive,
                                ]}
                                onPress={() => setWeekStartDay(opt.value)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.segmentText,
                                        isActive && styles.segmentTextActive,
                                    ]}
                                >
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
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
        backgroundColor: Colors.freshSnow,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: Colors.textPrimary,
        marginBottom: 12,
    },
    segmentRow: {
        flexDirection: "row",
        backgroundColor: Colors.frostGray,
        borderRadius: 10,
        padding: 3,
    },
    segment: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
    },
    segmentActive: {
        backgroundColor: Colors.alpineBlue,
    },
    segmentText: {
        fontSize: 15,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    segmentTextActive: {
        color: Colors.headerText,
    },
});
