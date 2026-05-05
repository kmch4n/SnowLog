import { useCallback, useEffect, useRef, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { Colors } from "../constants/colors";
import { IconNames } from "../constants/icons";
import { getAllTags } from "../database/repositories/tagRepository";
import { useTranslation } from "../i18n/useTranslation";
import { endOfMonth, startOfMonth } from "../utils/dateUtils";
import type { FilterOptions, Tag } from "../types";
import { SkiResortSearch } from "./SkiResortSearch";
import { TagChip } from "./TagChip";
import { Icon } from "./ui/Icon";

interface FilterBarProps {
    filter: FilterOptions;
    onChange: (filter: FilterOptions) => void;
}

const DATE_PRESETS = [
    { key: "thisMonth" },
    { key: "lastMonth" },
    { key: "thisSeason" },
] as const;

type PresetKey = (typeof DATE_PRESETS)[number]["key"];

/** Compute dateFrom/dateTo (unix seconds) for a given preset */
function computeDateRange(key: PresetKey): { dateFrom: number; dateTo: number } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-based

    switch (key) {
        case "thisMonth":
            return { dateFrom: startOfMonth(year, month), dateTo: endOfMonth(year, month) };
        case "lastMonth": {
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;
            return { dateFrom: startOfMonth(prevYear, prevMonth), dateTo: endOfMonth(prevYear, prevMonth) };
        }
        case "thisSeason": {
            // Japanese ski season: November - May
            // Nov-Dec → current year Nov to next year May
            // Jan-May → previous year Nov to current year May
            // Jun-Oct → previous year Nov to current year May (last season)
            const seasonStartYear = month >= 11 ? year : year - 1;
            const seasonEndYear = month >= 11 ? year + 1 : year;
            return {
                dateFrom: startOfMonth(seasonStartYear, 11),
                dateTo: endOfMonth(seasonEndYear, 5),
            };
        }
    }
}

const DEBOUNCE_MS = 400;

/**
 * 動画一覧の絞り込みバー
 * テキスト検索・スキー場名・タグ・期間でのフィルタリングをサポート
 */
export function FilterBar({ filter, onChange }: FilterBarProps) {
    const { t } = useTranslation();
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [searchDraft, setSearchDraft] = useState(filter.searchText ?? "");
    const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clear any pending debounce on unmount so the callback cannot fire
    // against a stale parent (navigation away mid-typing).
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            getAllTags().then(setAllTags);
        }, [])
    );

    // Sync internal search state when parent clears filters
    useEffect(() => {
        setSearchDraft(filter.searchText ?? "");
    }, [filter.searchText]);

    // Sync preset state when parent clears date filters
    useEffect(() => {
        if (filter.dateFrom === undefined && filter.dateTo === undefined) {
            setActivePreset(null);
        }
    }, [filter.dateFrom, filter.dateTo]);

    function handleSearchChange(text: string) {
        setSearchDraft(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onChange({ ...filter, searchText: text.length > 0 ? text : undefined });
        }, DEBOUNCE_MS);
    }

    function clearSearch() {
        setSearchDraft("");
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onChange({ ...filter, searchText: undefined });
    }

    function toggleTag(tagId: number) {
        const current = filter.tagIds ?? [];
        const updated = current.includes(tagId)
            ? current.filter((id) => id !== tagId)
            : [...current, tagId];
        onChange({ ...filter, tagIds: updated.length > 0 ? updated : undefined });
    }

    function handlePresetPress(key: PresetKey) {
        if (activePreset === key) {
            // Deactivate
            setActivePreset(null);
            onChange({ ...filter, dateFrom: undefined, dateTo: undefined });
        } else {
            setActivePreset(key);
            const range = computeDateRange(key);
            onChange({ ...filter, dateFrom: range.dateFrom, dateTo: range.dateTo });
        }
    }

    function clearAll() {
        setActivePreset(null);
        setSearchDraft("");
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onChange({});
    }

    const hasActiveFilter =
        (filter.skiResortName && filter.skiResortName.length > 0) ||
        (filter.tagIds && filter.tagIds.length > 0) ||
        (filter.searchText && filter.searchText.length > 0) ||
        filter.dateFrom !== undefined ||
        filter.dateTo !== undefined;

    return (
        <View style={styles.container}>
            {/* Text search input */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    value={searchDraft}
                    onChangeText={handleSearchChange}
                    placeholder={t("search.searchPlaceholder")}
                    placeholderTextColor={Colors.textTertiary}
                    returnKeyType="search"
                    autoCorrect={false}
                />
                {searchDraft.length > 0 && (
                    <TouchableOpacity style={styles.searchClear} onPress={clearSearch}>
                        <Icon
                            name={IconNames.xmark}
                            size={18}
                            color={Colors.textTertiary}
                            weight="semibold"
                            fallback="×"
                            accessibilityLabel={t("a11y.iconClear")}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* Ski resort filter */}
            <View style={styles.resortRow}>
                <SkiResortSearch
                    value={filter.skiResortName ?? null}
                    onSelect={(name) =>
                        onChange({ ...filter, skiResortName: name ?? undefined })
                    }
                />
            </View>

            {/* Tag filter */}
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

            {/* Date preset chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.presetScroll}
                contentContainerStyle={styles.presetScrollContent}
            >
                {DATE_PRESETS.map((preset) => {
                    const active = activePreset === preset.key;
                    return (
                        <TouchableOpacity
                            key={preset.key}
                            style={[styles.presetChip, active && styles.presetChipActive]}
                            onPress={() => handlePresetPress(preset.key)}
                        >
                            <Text style={[styles.presetText, active && styles.presetTextActive]}>
                                {t(`search.datePresets.${preset.key}`)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Clear all filters */}
            {hasActiveFilter && (
                <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
                    <Text style={styles.clearButtonText}>{t("search.clearAll")}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: Colors.textPrimary,
        backgroundColor: Colors.glacierWhite,
    },
    searchClear: {
        position: "absolute",
        right: 8,
        width: 24,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
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
    presetScroll: {
        marginTop: 4,
        marginBottom: 4,
    },
    presetScrollContent: {
        gap: 8,
    },
    presetChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: Colors.frostGray,
    },
    presetChipActive: {
        backgroundColor: Colors.alpineBlue,
    },
    presetText: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    presetTextActive: {
        color: Colors.headerText,
    },
    clearButton: {
        alignSelf: "flex-start",
        marginTop: 4,
    },
    clearButtonText: {
        fontSize: 12,
        color: Colors.error,
    },
});
