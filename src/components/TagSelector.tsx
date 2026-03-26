import { useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { getAllTags, getOrCreateTag } from "../database/repositories/tagRepository";
import type { Tag, TagType } from "../types";
import { TECHNIQUE_PRESETS } from "../constants/techniques";
import { TagChip } from "./TagChip";

interface TagSelectorProps {
    selectedTagIds: number[];
    onChange: (tagIds: number[]) => void;
}

const SECTION_LABELS: Record<TagType, string> = {
    technique: "滑走種別",
    skier: "滑走者",
    custom: "カスタムタグ",
};

/**
 * タグ選択UIコンポーネント
 * - 滑走種別プリセット
 * - 既存の滑走者タグ
 * - 自由入力カスタムタグ
 */
export function TagSelector({ selectedTagIds, onChange }: TagSelectorProps) {
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [customInput, setCustomInput] = useState("");

    useEffect(() => {
        loadTags();
    }, []);

    async function loadTags() {
        const tags = await getAllTags();
        setAllTags(tags);
    }

    function isSelected(tagId: number): boolean {
        return selectedTagIds.includes(tagId);
    }

    function toggleTag(tag: Tag) {
        if (isSelected(tag.id)) {
            onChange(selectedTagIds.filter((id) => id !== tag.id));
        } else {
            onChange([...selectedTagIds, tag.id]);
        }
    }

    async function handlePresetSelect(name: string) {
        const tag = await getOrCreateTag(name, "technique");
        setAllTags((prev) => (prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]));
        toggleTag(tag);
    }

    async function addCustomTag() {
        const name = customInput.trim();
        if (!name) return;

        const tag = await getOrCreateTag(name, "custom");
        setAllTags((prev) => (prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]));
        if (!isSelected(tag.id)) {
            onChange([...selectedTagIds, tag.id]);
        }
        setCustomInput("");
    }

    const skierTags = allTags.filter((t) => t.type === "skier");
    const customTags = allTags.filter((t) => t.type === "custom");

    return (
        <View style={styles.container}>
            {/* 滑走種別 */}
            <Text style={styles.sectionLabel}>{SECTION_LABELS.technique}</Text>
            <View style={styles.chips}>
                {TECHNIQUE_PRESETS.map((name) => {
                    const tag = allTags.find((t) => t.name === name && t.type === "technique");
                    const selected = tag ? isSelected(tag.id) : false;
                    return (
                        <TouchableOpacity
                            key={name}
                            onPress={() => handlePresetSelect(name)}
                            style={[styles.presetChip, selected && styles.presetChipSelected]}
                        >
                            <Text
                                style={[
                                    styles.presetChipText,
                                    selected && styles.presetChipTextSelected,
                                ]}
                            >
                                {name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* 滑走者 */}
            {skierTags.length > 0 && (
                <>
                    <Text style={styles.sectionLabel}>{SECTION_LABELS.skier}</Text>
                    <View style={styles.chips}>
                        {skierTags.map((tag) => (
                            <TouchableOpacity key={tag.id} onPress={() => toggleTag(tag)}>
                                <TagChip
                                    tag={tag}
                                    onRemove={isSelected(tag.id) ? () => toggleTag(tag) : undefined}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            {/* カスタムタグ */}
            <Text style={styles.sectionLabel}>{SECTION_LABELS.custom}</Text>
            <View style={styles.customInputRow}>
                <TextInput
                    style={styles.customInput}
                    value={customInput}
                    onChangeText={setCustomInput}
                    placeholder="タグを入力..."
                    onSubmitEditing={addCustomTag}
                    returnKeyType="done"
                />
                <TouchableOpacity style={styles.addButton} onPress={addCustomTag}>
                    <Text style={styles.addButtonText}>追加</Text>
                </TouchableOpacity>
            </View>
            {customTags.length > 0 && (
                <View style={styles.chips}>
                    {customTags.map((tag) => (
                        <TouchableOpacity key={tag.id} onPress={() => toggleTag(tag)}>
                            <TagChip
                                tag={tag}
                                onRemove={isSelected(tag.id) ? () => toggleTag(tag) : undefined}
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#555555",
        marginTop: 12,
        marginBottom: 6,
    },
    chips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    presetChip: {
        borderRadius: 100,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: "#F0F0F0",
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    presetChipSelected: {
        backgroundColor: "#1A3A5C",
        borderColor: "#1A3A5C",
    },
    presetChipText: {
        fontSize: 13,
        color: "#333333",
    },
    presetChipTextSelected: {
        color: "#FFFFFF",
        fontWeight: "600",
    },
    customInputRow: {
        flexDirection: "row",
        gap: 8,
        marginTop: 4,
    },
    customInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
    },
    addButton: {
        backgroundColor: "#1A3A5C",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        justifyContent: "center",
    },
    addButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
    },
});
