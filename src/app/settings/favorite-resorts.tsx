import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import {
    addFavoriteResort,
    getFavoriteResorts,
    removeFavoriteResort,
} from "@/database/repositories/favoriteResortRepository";
import { Colors } from "@/constants/colors";
import { IconNames } from "@/constants/icons";
import { Icon } from "@/components/ui/Icon";
import { SkiResortSearch } from "@/components/SkiResortSearch";
import { useTranslation } from "@/i18n/useTranslation";

/**
 * お気に入りスキー場管理画面
 * 登録・削除を行う
 */
export default function FavoriteResortsScreen() {
    const { t } = useTranslation();
    const [favorites, setFavorites] = useState<string[]>([]);
    const [selectedResort, setSelectedResort] = useState<string | null>(null);

    const loadFavorites = useCallback(async () => {
        const data = await getFavoriteResorts();
        setFavorites(data);
    }, []);

    useEffect(() => {
        loadFavorites();
    }, [loadFavorites]);

    const handleAdd = useCallback(async () => {
        if (!selectedResort) return;

        if (favorites.includes(selectedResort)) {
            Alert.alert(
                t("settings.common.addFailed"),
                t("settings.favoriteResorts.duplicateName")
            );
            return;
        }

        await addFavoriteResort(selectedResort);
        setSelectedResort(null);
        await loadFavorites();
    }, [selectedResort, favorites, loadFavorites, t]);

    const handleDelete = useCallback(
        (name: string) => {
            Alert.alert(
                t("settings.common.deleteConfirm"),
                t("settings.favoriteResorts.deleteConfirm.body", { name }),
                [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                        text: t("common.delete"),
                        style: "destructive",
                        onPress: async () => {
                            await removeFavoriteResort(name);
                            await loadFavorites();
                        },
                    },
                ]
            );
        },
        [loadFavorites, t]
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {/* 追加フォーム（上部に配置してサジェストが下方向に展開できるようにする） */}
            <View style={styles.addForm}>
                <View style={styles.addSearch}>
                    <SkiResortSearch value={selectedResort} onSelect={setSelectedResort} />
                </View>
                <TouchableOpacity
                    style={[styles.addButton, !selectedResort && styles.addButtonDisabled]}
                    onPress={handleAdd}
                    disabled={!selectedResort}
                >
                    <Text style={styles.addButtonText}>{t("common.add")}</Text>
                </TouchableOpacity>
            </View>

            {/* お気に入り一覧 */}
            <FlatList
                data={favorites}
                keyExtractor={(item) => item}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {t("settings.favoriteResorts.emptyWithHint")}
                    </Text>
                }
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <View style={styles.rowLabelGroup}>
                            <Icon
                                name={IconNames.starFill}
                                size={16}
                                color={Colors.morningGold}
                                fallback="⭐"
                                accessibilityLabel={t("a11y.iconFavorite")}
                            />
                            <Text style={styles.rowText}>{item}</Text>
                        </View>
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
                keyboardShouldPersistTaps="handled"
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    addForm: {
        flexDirection: "row",
        gap: 8,
        padding: 16,
        backgroundColor: Colors.freshSnow,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        alignItems: "flex-start",
        zIndex: 10,
    },
    addSearch: {
        flex: 1,
    },
    addButton: {
        backgroundColor: Colors.alpineBlue,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-start",
    },
    addButtonDisabled: {
        backgroundColor: Colors.textTertiary,
    },
    addButtonText: {
        color: Colors.headerText,
        fontSize: 14,
        fontWeight: "600",
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
    rowLabelGroup: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
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
        lineHeight: 22,
    },
});
