import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import {
    FATIGUE_LEVEL_OPTIONS,
    SNOW_CONDITION_OPTIONS,
    WEATHER_OPTIONS,
} from "@/constants/diaryOptions";
import { formatDate } from "@/utils/dateUtils";
import { DiaryOptionChips } from "./DiaryOptionChips";
import { SkiResortSearch } from "./SkiResortSearch";
import type { DiaryEntry } from "@/types";
import type { DiaryEntryInsert } from "@/database/schema";

/** Parse snow_condition JSON string into string array (safe fallback) */
function parseSnowConditions(raw: string | null): string[] {
    if (raw == null) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [raw];
    } catch {
        // Legacy single-value string (e.g. "powder")
        return raw !== "" ? [raw] : [];
    }
}

interface DiaryEditModalProps {
    visible: boolean;
    dateKey: string;
    diary: DiaryEntry | null;
    onSave: (
        data: Omit<DiaryEntryInsert, "id" | "createdAt" | "updatedAt">
    ) => Promise<void>;
    onDelete: () => Promise<void>;
    onClose: () => void;
}

/**
 * Full-screen modal for creating/editing a diary entry.
 * Core fields (weather, snow condition, impressions) are always visible.
 * Optional fields are hidden behind a collapsible section.
 */
export function DiaryEditModal({
    visible,
    dateKey,
    diary,
    onSave,
    onDelete,
    onClose,
}: DiaryEditModalProps) {
    // --- Core fields ---
    const [weather, setWeather] = useState<string | null>(null);
    const [snowConditions, setSnowConditions] = useState<string[]>([]);
    const [skiResortName, setSkiResortName] = useState<string | null>(null);
    const [impressions, setImpressions] = useState("");

    // --- Optional fields ---
    const [temperature, setTemperature] = useState("");
    const [companions, setCompanions] = useState("");
    const [fatigueLevel, setFatigueLevel] = useState<number | null>(null);
    const [expenses, setExpenses] = useState("");
    const [numberOfRuns, setNumberOfRuns] = useState("");
    const [showOptional, setShowOptional] = useState(false);

    const isEditing = diary != null;

    // Populate form when diary changes or modal opens
    useEffect(() => {
        if (!visible) return;
        if (diary) {
            setWeather(diary.weather);
            setSnowConditions(parseSnowConditions(diary.snowCondition));
            setSkiResortName(diary.skiResortName);
            setImpressions(diary.impressions);
            setTemperature(
                diary.temperature != null ? String(diary.temperature) : ""
            );
            setCompanions(diary.companions ?? "");
            setFatigueLevel(diary.fatigueLevel);
            setExpenses(diary.expenses != null ? String(diary.expenses) : "");
            setNumberOfRuns(
                diary.numberOfRuns != null ? String(diary.numberOfRuns) : ""
            );
            // Show optional section if any optional field has data
            setShowOptional(
                diary.temperature != null ||
                    (diary.companions ?? "") !== "" ||
                    diary.fatigueLevel != null ||
                    diary.expenses != null ||
                    diary.numberOfRuns != null
            );
        } else {
            setWeather(null);
            setSnowConditions([]);
            setSkiResortName(null);
            setImpressions("");
            setTemperature("");
            setCompanions("");
            setFatigueLevel(null);
            setExpenses("");
            setNumberOfRuns("");
            setShowOptional(false);
        }
    }, [visible, diary]);

    const parseIntOrNull = (text: string): number | null => {
        const n = parseInt(text, 10);
        return Number.isNaN(n) ? null : n;
    };

    const hasContent =
        weather != null ||
        snowConditions.length > 0 ||
        (skiResortName ?? "") !== "" ||
        impressions.trim() !== "" ||
        temperature !== "" ||
        companions.trim() !== "" ||
        fatigueLevel != null ||
        expenses !== "" ||
        numberOfRuns !== "";

    // Auto-save on close: save if any field has content, skip if completely empty
    const handleClose = useCallback(async () => {
        if (hasContent) {
            await onSave({
                dateKey,
                skiResortName: skiResortName || null,
                weather: weather || null,
                snowCondition: snowConditions.length > 0 ? JSON.stringify(snowConditions) : null,
                impressions: impressions.trim(),
                temperature: parseIntOrNull(temperature),
                companions: companions.trim() || null,
                fatigueLevel,
                expenses: parseIntOrNull(expenses),
                numberOfRuns: parseIntOrNull(numberOfRuns),
            });
        }
        onClose();
    }, [
        hasContent,
        dateKey,
        skiResortName,
        weather,
        snowConditions,
        impressions,
        temperature,
        companions,
        fatigueLevel,
        expenses,
        numberOfRuns,
        onSave,
        onClose,
    ]);

    const handleDelete = useCallback(() => {
        Alert.alert("日記を削除", "この日の日記を削除しますか？", [
            { text: "キャンセル", style: "cancel" },
            {
                text: "削除",
                style: "destructive",
                onPress: async () => {
                    await onDelete();
                    onClose();
                },
            },
        ]);
    }, [onDelete, onClose]);

    // Convert dateKey "YYYY-MM-DD" to displayable date
    const displayDate = (() => {
        const parts = dateKey.split("-");
        if (parts.length === 3) {
            const ts = new Date(
                Number(parts[0]),
                Number(parts[1]) - 1,
                Number(parts[2])
            ).getTime() / 1000;
            return formatDate(ts);
        }
        return dateKey;
    })();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} hitSlop={8}>
                        <Text style={styles.closeButton}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{displayDate}</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Weather */}
                    <View style={styles.section}>
                        <Text style={styles.label}>天気</Text>
                        <DiaryOptionChips
                            options={WEATHER_OPTIONS}
                            selected={weather}
                            onChange={setWeather}
                            showIcon
                        />
                    </View>

                    {/* Snow condition (multi-select) */}
                    <View style={styles.section}>
                        <Text style={styles.label}>雪質</Text>
                        <DiaryOptionChips
                            options={SNOW_CONDITION_OPTIONS}
                            selected={snowConditions}
                            onChange={setSnowConditions}
                            multiple
                        />
                    </View>

                    {/* Ski resort */}
                    <View style={styles.section}>
                        <Text style={styles.label}>スキー場</Text>
                        <SkiResortSearch
                            value={skiResortName}
                            onSelect={setSkiResortName}
                        />
                    </View>

                    {/* Impressions */}
                    <View style={styles.section}>
                        <Text style={styles.label}>感想</Text>
                        <TextInput
                            style={styles.impressionsInput}
                            value={impressions}
                            onChangeText={setImpressions}
                            placeholder="今日の感想を書く..."
                            placeholderTextColor={Colors.textTertiary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Optional section toggle */}
                    <TouchableOpacity
                        style={styles.optionalToggle}
                        onPress={() => setShowOptional((v) => !v)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.optionalToggleText}>
                            {showOptional
                                ? "▾ その他の項目を閉じる"
                                : "▸ その他の項目"}
                        </Text>
                    </TouchableOpacity>

                    {/* Optional fields */}
                    {showOptional && (
                        <Animated.View
                            entering={FadeIn.duration(200)}
                            exiting={FadeOut.duration(150)}
                        >
                            {/* Temperature */}
                            <View style={styles.section}>
                                <Text style={styles.label}>気温</Text>
                                <View style={styles.inlineInputRow}>
                                    <TextInput
                                        style={styles.numberInput}
                                        value={temperature}
                                        onChangeText={setTemperature}
                                        placeholder="-5"
                                        placeholderTextColor={
                                            Colors.textTertiary
                                        }
                                        keyboardType="number-pad"
                                    />
                                    <Text style={styles.unit}>°C</Text>
                                </View>
                            </View>

                            {/* Companions */}
                            <View style={styles.section}>
                                <Text style={styles.label}>同行者</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={companions}
                                    onChangeText={setCompanions}
                                    placeholder="一緒に行った人"
                                    placeholderTextColor={Colors.textTertiary}
                                />
                            </View>

                            {/* Fatigue level */}
                            <View style={styles.section}>
                                <Text style={styles.label}>疲労度</Text>
                                <DiaryOptionChips
                                    options={FATIGUE_LEVEL_OPTIONS}
                                    selected={fatigueLevel}
                                    onChange={setFatigueLevel}
                                />
                            </View>

                            {/* Expenses */}
                            <View style={styles.section}>
                                <Text style={styles.label}>費用</Text>
                                <View style={styles.inlineInputRow}>
                                    <TextInput
                                        style={styles.numberInput}
                                        value={expenses}
                                        onChangeText={setExpenses}
                                        placeholder="5000"
                                        placeholderTextColor={
                                            Colors.textTertiary
                                        }
                                        keyboardType="number-pad"
                                    />
                                    <Text style={styles.unit}>円</Text>
                                </View>
                            </View>

                            {/* Number of runs */}
                            <View style={styles.section}>
                                <Text style={styles.label}>滑走本数</Text>
                                <View style={styles.inlineInputRow}>
                                    <TextInput
                                        style={styles.numberInput}
                                        value={numberOfRuns}
                                        onChangeText={setNumberOfRuns}
                                        placeholder="10"
                                        placeholderTextColor={
                                            Colors.textTertiary
                                        }
                                        keyboardType="number-pad"
                                    />
                                    <Text style={styles.unit}>本</Text>
                                </View>
                            </View>
                        </Animated.View>
                    )}
                    {/* Delete button at bottom of scroll (same style as video detail) */}
                    {isEditing && (
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={handleDelete}
                        >
                            <Text style={styles.deleteButtonText}>
                                この日の日記を削除
                            </Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.freshSnow,
    },
    closeButton: {
        fontSize: 18,
        color: Colors.textSecondary,
        paddingHorizontal: 4,
    },
    headerTitle: {
        flex: 1,
        textAlign: "center",
        fontSize: 16,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    headerSpacer: {
        width: 26,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    section: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.textSecondary,
        marginBottom: 8,
    },
    impressionsInput: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        padding: 12,
        fontSize: 15,
        color: Colors.textPrimary,
        minHeight: 100,
    },
    textInput: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: Colors.textPrimary,
    },
    numberInput: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: Colors.textPrimary,
        width: 100,
        textAlign: "right",
    },
    inlineInputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    unit: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    optionalToggle: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 4,
    },
    optionalToggleText: {
        fontSize: 14,
        color: Colors.alpineBlue,
        fontWeight: "600",
    },
    deleteButton: {
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 16,
        paddingVertical: 12,
        alignItems: "center",
    },
    deleteButtonText: {
        fontSize: 13,
        color: Colors.textTertiary,
        fontWeight: "500",
    },
});
