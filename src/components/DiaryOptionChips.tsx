import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import type { DiaryOption } from "@/constants/diaryOptions";
import { useTranslation } from "@/i18n/useTranslation";

interface SingleSelectProps<T extends string | number> {
    options: DiaryOption<T>[];
    selected: T | null;
    onChange: (value: T | null) => void;
    multiple?: false;
    showIcon?: boolean;
    labelPrefix?: string;
}

interface MultiSelectProps<T extends string | number> {
    options: DiaryOption<T>[];
    selected: T[];
    onChange: (value: T[]) => void;
    multiple: true;
    showIcon?: boolean;
    labelPrefix?: string;
}

type DiaryOptionChipsProps<T extends string | number> =
    | SingleSelectProps<T>
    | MultiSelectProps<T>;

/**
 * Chip row for diary fields.
 * Single-select (default): tapping the selected chip deselects it.
 * Multi-select (multiple=true): tapping toggles each chip independently.
 */
export function DiaryOptionChips<T extends string | number>(
    props: DiaryOptionChipsProps<T>
) {
    const { options, showIcon = false, labelPrefix } = props;
    const { t } = useTranslation();

    const resolveLabel = (option: DiaryOption<T>): string =>
        labelPrefix ? t(`${labelPrefix}.${option.value}`) : option.label;

    // Normalize selected into a Set for unified rendering
    const selectedSet = new Set<T>(
        props.multiple ? props.selected : props.selected != null ? [props.selected] : []
    );

    function handlePress(value: T) {
        if (props.multiple) {
            const next = selectedSet.has(value)
                ? props.selected.filter((v) => v !== value)
                : [...props.selected, value];
            props.onChange(next);
        } else {
            props.onChange(selectedSet.has(value) ? null : value);
        }
    }

    return (
        <View style={styles.container}>
            {options.map((opt) => {
                const isSelected = selectedSet.has(opt.value);
                return (
                    <TouchableOpacity
                        key={String(opt.value)}
                        onPress={() => handlePress(opt.value)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                isSelected && styles.chipTextSelected,
                            ]}
                        >
                            {showIcon && opt.icon ? `${opt.icon} ` : ""}
                            {resolveLabel(opt)}
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
});
