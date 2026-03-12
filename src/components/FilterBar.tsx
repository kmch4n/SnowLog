import { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { getAllTags } from "../database/repositories/tagRepository";
import type { FilterOptions, Tag } from "../types";
import { TagChip } from "./TagChip";

interface FilterBarProps {
    filter: FilterOptions;
    onChange: (filter: FilterOptions) => void;
}

/**
 * 動画一覧の絞り込みバー
 * スキー場名・タグでのフィルタリングをサポート
 */
export function FilterBar({ filter, onChange }: FilterBarProps) {
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [resortInput, setResortInput] = useState(filter.skiResortName ?? "");

    useEffect(() => {
        getAllTags().then(setAllTags);
    }, []);

    function toggleTag(tagId: number) {
        const current = filter.tagIds ?? [];
        const updated = current.includes(tagId)
            ? current.filter((id) => id !== tagId)
            : [...current, tagId];
        onChange({ ...filter, tagIds: updated.length > 0 ? updated : undefined });
    }

    function applyResortFilter() {
        onChange({
            ...filter,
            skiResortName: resortInput.trim() || undefined,
        });
    }

    function clearAll() {
        setResortInput("");
        onChange({});
    }

    const hasActiveFilter =
        (filter.skiResortName && filter.skiResortName.length > 0) ||
        (filter.tagIds && filter.tagIds.length > 0);

    return (
        <View style={styles.container}>
            {/* スキー場名フィルター */}
            <View style={styles.resortRow}>
                <TextInput
                    style={styles.resortInput}
                    value={resortInput}
                    onChangeText={setResortInput}
                    placeholder="スキー場で絞り込み"
                    onSubmitEditing={applyResortFilter}
                    returnKeyType="search"
                />
                <TouchableOpacity style={styles.searchButton} onPress={applyResortFilter}>
                    <Text style={styles.searchButtonText}>検索</Text>
                </TouchableOpacity>
            </View>

            {/* タグフィルター */}
            {allTags.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.tagScroll}
                    contentContainerStyle={styles.tagScrollContent}
                >
                    {allTags.map((tag) => {
                        const active = filter.tagIds?.includes(tag.id) ?? false;
                        return (
                            <TouchableOpacity key={tag.id} onPress={() => toggleTag(tag.id)}>
                                <View
                                    style={[
                                        styles.tagItem,
                                        active && styles.tagItemActive,
                                    ]}
                                >
                                    <TagChip tag={tag} />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {/* フィルタークリア */}
            {hasActiveFilter && (
                <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
                    <Text style={styles.clearButtonText}>フィルターをクリア</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F0F0F0",
    },
    resortRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
    resortInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
    },
    searchButton: {
        backgroundColor: "#1A3A5C",
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        justifyContent: "center",
    },
    searchButtonText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600",
    },
    tagScroll: {
        marginBottom: 4,
    },
    tagScrollContent: {
        gap: 6,
    },
    tagItem: {
        opacity: 0.5,
    },
    tagItemActive: {
        opacity: 1,
    },
    clearButton: {
        alignSelf: "flex-start",
        marginTop: 4,
    },
    clearButtonText: {
        fontSize: 12,
        color: "#E53935",
    },
});
