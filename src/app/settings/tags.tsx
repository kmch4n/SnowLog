import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    deleteCustomTag,
    getAllTags,
    getOrCreateTag,
} from "@/database/repositories/tagRepository";
import { Colors } from "@/constants/colors";
import { useTranslation } from "@/i18n/useTranslation";
import type { Tag } from "@/types";

/**
 * カスタムタグ管理画面
 * タグの追加・削除を行う
 */
export default function TagsSettingsScreen() {
    const { t } = useTranslation();
    const [customTags, setCustomTags] = useState<Tag[]>([]);
    const [input, setInput] = useState("");

    const loadTags = useCallback(async () => {
        const all = await getAllTags();
        setCustomTags(all.filter((t) => t.type === "custom"));
    }, []);

    useEffect(() => {
        loadTags();
    }, [loadTags]);

    const handleAdd = useCallback(async () => {
        const name = input.trim();
        if (!name) return;

        if (customTags.some((t) => t.name === name)) {
            Alert.alert(
                t("settings.common.addFailed"),
                t("settings.tags.duplicateName")
            );
            return;
        }

        await getOrCreateTag(name, "custom");
        setInput("");
        await loadTags();
    }, [input, customTags, loadTags, t]);

    const handleDelete = useCallback(
        (tag: Tag) => {
            Alert.alert(
                t("settings.tags.deleteConfirm.title"),
                t("settings.tags.deleteConfirmDetailed", { name: tag.name }),
                [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                        text: t("common.delete"),
                        style: "destructive",
                        onPress: async () => {
                            await deleteCustomTag(tag.id);
                            await loadTags();
                        },
                    },
                ]
            );
        },
        [loadTags, t]
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <FlatList
                data={customTags}
                keyExtractor={(item) => String(item.id)}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {t("settings.tags.emptyWithHint")}
                    </Text>
                }
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <Text style={styles.rowText}>{item.name}</Text>
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDelete(item)}
                        >
                            <Text style={styles.deleteButtonText}>{t("common.delete")}</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                contentContainerStyle={styles.list}
            />

            {/* 追加フォーム */}
            <View style={styles.addForm}>
                <TextInput
                    style={styles.addInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder={t("settings.tags.addPlaceholder")}
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
