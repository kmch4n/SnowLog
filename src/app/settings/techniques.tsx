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
import { useHeaderHeight } from "@react-navigation/elements";

import {
    deleteTechniqueOption,
    getAllTechniqueOptions,
    insertTechniqueOption,
    reorderTechniqueOptions,
} from "@/database/repositories/techniqueOptionRepository";
import { Colors } from "@/constants/colors";
import type { TechniqueOptionSelect } from "@/database/schema";

/**
 * 滑走種別管理画面
 * 種別の追加・削除を行う
 */
export default function TechniquesSettingsScreen() {
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
            Alert.alert("追加できません", "同じ名前の種別がすでに存在します");
            return;
        }

        await insertTechniqueOption(name);
        setInput("");
        await loadOptions();
    }, [input, options, loadOptions]);

    const handleMove = useCallback(
        async (index: number, direction: "up" | "down") => {
            const swapIndex = direction === "up" ? index - 1 : index + 1;
            if (swapIndex < 0 || swapIndex >= options.length) return;

            const reordered = [...options];
            [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
            setOptions(reordered);
            await reorderTechniqueOptions(reordered.map((o) => o.id));
        },
        [options]
    );

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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={headerHeight}
        >
            <FlatList
                data={options}
                keyExtractor={(item) => String(item.id)}
                ListEmptyComponent={
                    <Text style={styles.empty}>種別がありません。下のフォームから追加してください。</Text>
                }
                renderItem={({ item, index }) => (
                    <View style={styles.row}>
                        <View style={styles.reorderButtons}>
                            <TouchableOpacity
                                onPress={() => handleMove(index, "up")}
                                disabled={index === 0}
                                hitSlop={8}
                            >
                                <Text style={[styles.arrowText, index === 0 && styles.arrowDisabled]}>▲</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleMove(index, "down")}
                                disabled={index === options.length - 1}
                                hitSlop={8}
                            >
                                <Text style={[styles.arrowText, index === options.length - 1 && styles.arrowDisabled]}>▼</Text>
                            </TouchableOpacity>
                        </View>
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
    reorderButtons: {
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        marginRight: 12,
    },
    arrowText: {
        fontSize: 12,
        color: Colors.alpineBlue,
        fontWeight: "700",
    },
    arrowDisabled: {
        color: Colors.border,
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
