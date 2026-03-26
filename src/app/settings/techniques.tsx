import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    deleteTechniqueOption,
    getAllTechniqueOptions,
    insertTechniqueOption,
} from "@/database/repositories/techniqueOptionRepository";
import type { TechniqueOptionSelect } from "@/database/schema";

/**
 * 滑走種別管理画面
 * 種別の追加・削除を行う
 */
export default function TechniquesSettingsScreen() {
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
            Alert.alert("追加できません", "同じ名前の種別がすでに存在します");
            return;
        }

        await insertTechniqueOption(name);
        setInput("");
        await loadOptions();
    }, [input, options, loadOptions]);

    const handleDelete = useCallback(
        (option: TechniqueOptionSelect) => {
            Alert.alert(
                "削除の確認",
                `「${option.name}」を削除しますか？\n（この種別が設定された動画には影響しません）`,
                [
                    { text: "キャンセル", style: "cancel" },
                    {
                        text: "削除",
                        style: "destructive",
                        onPress: async () => {
                            await deleteTechniqueOption(option.id);
                            await loadOptions();
                        },
                    },
                ]
            );
        },
        [loadOptions]
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={options}
                keyExtractor={(item) => String(item.id)}
                ListEmptyComponent={
                    <Text style={styles.empty}>種別がありません。下のフォームから追加してください。</Text>
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
                    placeholder="種別名を入力..."
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
        </View>
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
