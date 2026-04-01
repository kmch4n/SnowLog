import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../constants/colors";
import type { Tag } from "../types";

interface TagChipProps {
    tag: Tag;
    onRemove?: () => void;
}

/**
 * タグを表示するチップコンポーネント
 * onRemove を渡すと削除ボタンが表示される
 */
export function TagChip({ tag, onRemove }: TagChipProps) {
    const tagColors = Colors.tag[tag.type as keyof typeof Colors.tag] ?? Colors.tag.custom;

    return (
        <View style={[styles.chip, { backgroundColor: tagColors.bg }]}>
            <Text style={[styles.label, { color: tagColors.text }]}>{tag.name}</Text>
            {onRemove && (
                <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.removeButton}>
                    <Text style={[styles.removeIcon, { color: tagColors.text }]}>×</Text>
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
