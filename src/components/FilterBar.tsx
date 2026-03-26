import { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { getAllTags } from "../database/repositories/tagRepository";
import type { FilterOptions, Tag } from "../types";
import { SkiResortSearch } from "./SkiResortSearch";
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

    function clearAll() {
        onChange({});
    }

    const hasActiveFilter =
        (filter.skiResortName && filter.skiResortName.length > 0) ||
        (filter.tagIds && filter.tagIds.length > 0);

    return (
        <View style={styles.container}>
            {/* スキー場フィルター */}
            <View style={styles.resortRow}>
                <SkiResortSearch
                    value={filter.skiResortName ?? null}
                    onSelect={(name) =>
                        onChange({ ...filter, skiResortName: name ?? undefined })
                    }
                />
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
        marginBottom: 8,
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
