import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../constants/colors";
import { IconNames } from "../constants/icons";
import { useTranslation } from "../i18n/useTranslation";
import type { Tag } from "../types";
import { Icon } from "./ui/Icon";

interface TagChipProps {
    tag: Tag;
    onRemove?: () => void;
}

/**
 * タグを表示するチップコンポーネント
 * onRemove を渡すと削除ボタンが表示される
 */
export function TagChip({ tag, onRemove }: TagChipProps) {
    const { t } = useTranslation();
    const tagColors = Colors.tag[tag.type as keyof typeof Colors.tag] ?? Colors.tag.custom;
    const isCustom = tag.type === "custom";

    return (
        <View
            style={[
                styles.chip,
                { backgroundColor: tagColors.bg },
                isCustom && [styles.customChip, { borderColor: tagColors.text }],
            ]}
        >
            {isCustom && (
                <View
                    style={[
                        styles.customAccent,
                        { backgroundColor: tagColors.text },
                    ]}
                />
            )}
            <Text style={[styles.label, { color: tagColors.text }]}>{tag.name}</Text>
            {onRemove && (
                <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.removeButton}>
                    <Icon
                        name={IconNames.xmark}
                        size={14}
                        color={tagColors.text}
                        weight="semibold"
                        fallback="×"
                        accessibilityLabel={t("a11y.iconRemove")}
                    />
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
    customChip: {
        borderRadius: 6,
        borderWidth: 1,
        gap: 5,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    customAccent: {
        width: 3,
        height: 13,
        borderRadius: 2,
    },
    label: {
        fontSize: 12,
        fontWeight: "500",
    },
    removeButton: {
        marginLeft: 4,
    },
});
