import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { Colors } from "../constants/colors";
import { getAllTechniqueOptions } from "../database/repositories/techniqueOptionRepository";
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

    if (options.length === 0) {
        return (
            <Text style={styles.empty}>設定から滑走種別を追加してください</Text>
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
                    >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {opt.name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
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
