import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { Colors } from "../constants/colors";
import { getAllTechniqueOptions } from "../database/repositories/techniqueOptionRepository";
import { useTranslation } from "../i18n/useTranslation";
import type { TechniqueOptionSelect } from "../database/schema";

interface TechniqueSelectorProps {
    selected: string[];
    onChange: (techniques: string[]) => void;
}

/**
 * 滑走種別プリセット選択コンポーネント
 * 完全制御コンポーネント。選択肢は technique_options テーブルから取得する
 */
export function TechniqueSelector({ selected, onChange }: TechniqueSelectorProps) {
    const { t } = useTranslation();
    const [options, setOptions] = useState<TechniqueOptionSelect[]>([]);

    useFocusEffect(
        useCallback(() => {
            getAllTechniqueOptions().then(setOptions);
        }, [])
    );

    function toggle(name: string) {
        if (selected.includes(name)) {
            onChange(selected.filter((t) => t !== name));
        } else {
            onChange([...selected, name]);
        }
    }

    // 設定で消した種別が付いたままの動画がある。選択肢に無くても選択中として出し、
    // 押せば外せるようにする（出さないと、カードや統計には残るのに外す手段が無い）
    const optionNames = new Set(options.map((opt) => opt.name));
    const removedButSelected = selected.filter((name) => !optionNames.has(name));

    if (options.length === 0 && removedButSelected.length === 0) {
        return (
            <Text style={styles.empty}>{t("components.techniqueSelector.manageHint")}</Text>
        );
    }

    return (
        <View style={styles.container}>
            {options.map((opt) => {
                const isSelected = selected.includes(opt.name);
                return (
                    <TouchableOpacity
                        key={opt.id}
                        onPress={() => toggle(opt.name)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                    >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {opt.name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
            {removedButSelected.map((name) => (
                <TouchableOpacity
                    key={`removed:${name}`}
                    onPress={() => toggle(name)}
                    style={[styles.chip, styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: true }}
                >
                    <Text style={[styles.chipText, styles.chipTextSelected]}>{name}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    chip: {
        borderRadius: 100,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: Colors.frostGray,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    chipSelected: {
        backgroundColor: Colors.alpineBlue,
        borderColor: Colors.alpineBlue,
    },
    chipText: {
        fontSize: 13,
        color: Colors.textPrimary,
    },
    chipTextSelected: {
        color: Colors.headerText,
        fontWeight: "600",
    },
    empty: {
        fontSize: 13,
        color: Colors.textTertiary,
    },
});
