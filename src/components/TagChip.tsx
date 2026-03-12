import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Tag } from "../types";

// タグ種別ごとの配色
const TAG_COLORS: Record<string, { background: string; text: string }> = {
    technique: { background: "#E3F2FD", text: "#1565C0" },
    skier: { background: "#F3E5F5", text: "#6A1B9A" },
    custom: { background: "#E8F5E9", text: "#2E7D32" },
};

interface TagChipProps {
    tag: Tag;
    onRemove?: () => void;
}

/**
 * タグを表示するチップコンポーネント
 * onRemove を渡すと削除ボタンが表示される
 */
export function TagChip({ tag, onRemove }: TagChipProps) {
    const colors = TAG_COLORS[tag.type] ?? TAG_COLORS.custom;

    return (
        <View style={[styles.chip, { backgroundColor: colors.background }]}>
            <Text style={[styles.label, { color: colors.text }]}>{tag.name}</Text>
            {onRemove && (
                <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.removeButton}>
                    <Text style={[styles.removeIcon, { color: colors.text }]}>×</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 100,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    label: {
        fontSize: 12,
        fontWeight: "500",
    },
    removeButton: {
        marginLeft: 4,
    },
    removeIcon: {
        fontSize: 14,
        lineHeight: 16,
    },
});
