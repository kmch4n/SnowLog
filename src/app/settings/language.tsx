import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useTranslation } from "@/i18n/useTranslation";
import type { LocalePreference } from "@/i18n/types";

interface LanguageOption {
    value: LocalePreference;
    labelKey: string;
}

const OPTIONS: LanguageOption[] = [
    { value: "device", labelKey: "settings.language.optionDevice" },
    { value: "ja", labelKey: "settings.language.optionJa" },
    { value: "en", labelKey: "settings.language.optionEn" },
];

export default function LanguageSettingsScreen() {
    const { t, preference, setPreference } = useTranslation();

    return (
        <View style={styles.container}>
            <Text style={styles.description}>
                {t("settings.language.description")}
            </Text>
            <View style={styles.section}>
                {OPTIONS.map((option, index) => {
                    const isSelected = preference === option.value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.row,
                                index === 0 && styles.rowFirst,
                                index === OPTIONS.length - 1 && styles.rowLast,
                            ]}
                            onPress={() => {
                                if (!isSelected) {
                                    setPreference(option.value).catch(() => {});
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.rowLabel}>{t(option.labelKey)}</Text>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>
                    );
                })}
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
    description: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginBottom: 12,
        lineHeight: 18,
    },
    section: {
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Colors.border,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    rowFirst: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    rowLast: {
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    rowLabel: {
        fontSize: 16,
        color: Colors.textPrimary,
    },
    checkmark: {
        fontSize: 16,
        color: Colors.alpineBlue,
        fontWeight: "700",
    },
});
