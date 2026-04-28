import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";

import {
    deleteTechniqueOption,
    getAllTechniqueOptions,
    insertTechniqueOption,
    reorderTechniqueOptions,
} from "@/database/repositories/techniqueOptionRepository";
import { Colors } from "@/constants/colors";
import type { TechniqueOptionSelect } from "@/database/schema";
import { useTranslation } from "@/i18n/useTranslation";

/**
 * 滑走種別管理画面
 * 種別の追加・削除・ドラッグ並べ替えを行う
 */
export default function TechniquesSettingsScreen() {
    const { t } = useTranslation();
    const headerHeight = useHeaderHeight();
    const [options, setOptions] = useState<TechniqueOptionSelect[]>([]);
    const [input, setInput] = useState("");

    const loadOptions = useCallback(async () => {
        const data = await getAllTechniqueOptions();
        setOptions(data);
    }, []);

    useEffect(() => {
        loadOptions();
    }, [loadOptions]);

    const handleAdd = useCallback(async () => {
        const name = input.trim();
        if (!name) return;

        if (options.some((o) => o.name === name)) {
            Alert.alert(
                t("settings.common.addFailed"),
                t("settings.techniques.duplicateName")
            );
            return;
        }

        await insertTechniqueOption(name);
        setInput("");
        await loadOptions();
    }, [input, options, loadOptions, t]);

    const handleDragEnd = useCallback(
        async ({ data }: { data: TechniqueOptionSelect[] }) => {
            setOptions(data);
            await reorderTechniqueOptions(data.map((o) => o.id));
        },
        []
    );

    const handleDelete = useCallback(
        (option: TechniqueOptionSelect) => {
            Alert.alert(
                t("settings.common.deleteConfirm"),
                t("settings.techniques.deleteConfirmWithImpact", { name: option.name }),
                [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                        text: t("common.delete"),
                        style: "destructive",
                        onPress: async () => {
                            await deleteTechniqueOption(option.id);
                            await loadOptions();
                        },
                    },
                ]
            );
        },
        [loadOptions, t]
    );

    const renderItem = useCallback(
        ({ item, drag, isActive }: RenderItemParams<TechniqueOptionSelect>) => (
            <View style={[styles.row, isActive && styles.rowActive]}>
                <TouchableOpacity
                    onLongPress={drag}
                    delayLongPress={100}
                    style={styles.dragHandle}
                >
                    <Text style={styles.dragHandleText}>☰</Text>
                </TouchableOpacity>
                <Text style={styles.rowText}>{item.name}</Text>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                >
                    <Text style={styles.deleteButtonText}>{t("common.delete")}</Text>
                </TouchableOpacity>
            </View>
        ),
        [handleDelete, t]
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={headerHeight}
        >
            <DraggableFlatList
                data={options}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                onDragEnd={handleDragEnd}
                ListEmptyComponent={
                    <Text style={styles.empty}>{t("settings.techniques.emptyWithHint")}</Text>
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                contentContainerStyle={styles.list}
            />

            {/* 追加フォーム */}
            <View style={styles.addForm}>
                <TextInput
                    style={styles.addInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder={t("settings.techniques.addPlaceholder")}
                    returnKeyType="done"
                    onSubmitEditing={handleAdd}
                />
                <TouchableOpacity
                    style={[styles.addButton, !input.trim() && styles.addButtonDisabled]}
                    onPress={handleAdd}
                    disabled={!input.trim()}
                >
                    <Text style={styles.addButtonText}>{t("common.add")}</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    list: {
        padding: 16,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 8,
    },
    rowActive: {
        backgroundColor: Colors.frostGray,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    dragHandle: {
        paddingRight: 12,
        paddingVertical: 4,
    },
    dragHandleText: {
        fontSize: 18,
        color: Colors.textTertiary,
    },
    rowText: {
        flex: 1,
        fontSize: 16,
        color: Colors.textPrimary,
    },
    deleteButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    deleteButtonText: {
        fontSize: 14,
        color: Colors.error,
        fontWeight: "600",
    },
    separator: {
        height: 1,
        backgroundColor: Colors.border,
        marginHorizontal: 16,
    },
    empty: {
        fontSize: 14,
        color: Colors.textTertiary,
        textAlign: "center",
        marginTop: 24,
    },
    addForm: {
        flexDirection: "row",
        gap: 8,
        padding: 16,
        backgroundColor: Colors.freshSnow,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    addInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        backgroundColor: Colors.frostGray,
    },
    addButton: {
        backgroundColor: Colors.alpineBlue,
        borderRadius: 8,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    addButtonDisabled: {
        backgroundColor: Colors.textTertiary,
    },
    addButtonText: {
        color: Colors.headerText,
        fontSize: 14,
        fontWeight: "600",
    },
});
