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
import type { Tag } from "@/types";

/**
 * カスタムタグ管理画面
 * タグの追加・削除を行う
 */
export default function TagsSettingsScreen() {
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
            Alert.alert("追加できません", "同じ名前のタグがすでに存在します。");
            return;
        }

        await getOrCreateTag(name, "custom");
        setInput("");
        await loadTags();
    }, [input, customTags, loadTags]);

    const handleDelete = useCallback(
        (tag: Tag) => {
            Alert.alert(
                "タグを削除",
                `「${tag.name}」を削除しますか？\nこの操作は取り消せません。このタグが付いた動画からも削除されます。`,
                [
                    { text: "キャンセル", style: "cancel" },
                    {
                        text: "削除",
                        style: "destructive",
                        onPress: async () => {
                            await deleteCustomTag(tag.id);
                            await loadTags();
                        },
                    },
                ]
            );
        },
        [loadTags]
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
                        カスタムタグがありません。下のフォームから追加してください。
                    </Text>
                }
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <Text style={styles.rowText}>{item.name}</Text>
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDelete(item)}
                        >
                            <Text style={styles.deleteButtonText}>削除</Text>
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
                    placeholder="タグ名を入力..."
                    returnKeyType="done"
                    onSubmitEditing={handleAdd}
                />
                <TouchableOpacity
                    style={[styles.addButton, !input.trim() && styles.addButtonDisabled]}
                    onPress={handleAdd}
                    disabled={!input.trim()}
                >
                    <Text style={styles.addButtonText}>追加</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
    },
    list: {
        padding: 16,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 8,
    },
    rowText: {
        flex: 1,
        fontSize: 16,
        color: "#222222",
    },
    deleteButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    deleteButtonText: {
        fontSize: 14,
        color: "#CC3333",
        fontWeight: "600",
    },
    separator: {
        height: 1,
        backgroundColor: "#E0E0E0",
        marginHorizontal: 16,
    },
    empty: {
        fontSize: 14,
        color: "#AAAAAA",
        textAlign: "center",
        marginTop: 24,
    },
    addForm: {
        flexDirection: "row",
        gap: 8,
        padding: 16,
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#E0E0E0",
    },
    addInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        backgroundColor: "#FAFAFA",
    },
    addButton: {
        backgroundColor: "#1A3A5C",
        borderRadius: 8,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    addButtonDisabled: {
        backgroundColor: "#AAAAAA",
    },
    addButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
    },
});
