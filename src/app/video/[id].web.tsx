/**
 * Web用動画詳細画面
 * expo-video はブラウザ非対応のため、動画プレイヤーをグレーのプレースホルダーに置換する
 */
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { SkiResortSearch } from "@/components/SkiResortSearch";
import { TagChip } from "@/components/TagChip";
import { TagSelector } from "@/components/TagSelector";
import { exportAllToJSON } from "@/services/exportService";
import { useVideoDetail } from "@/hooks/useVideoDetail";
import { formatDate, formatDuration } from "@/utils/dateUtils";

export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const navigation = useNavigation();
    const { video, isLoading, updateMemo, updateSkiResort, updateTags } = useVideoDetail(id);

    const [isEditingMemo, setIsEditingMemo] = useState(false);
    const [memoInput, setMemoInput] = useState("");
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [tagIdInput, setTagIdInput] = useState<number[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleExport}
                    style={{ marginRight: 16 }}
                    disabled={isExporting}
                >
                    <Text style={{ color: "#FFFFFF", fontSize: 14 }}>
                        {isExporting ? "..." : "書き出し"}
                    </Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, isExporting]);

    useEffect(() => {
        if (video) {
            setMemoInput(video.memo);
            setTagIdInput(video.tags.map((t) => t.id));
        }
    }, [video]);

    const handleSaveMemo = useCallback(async () => {
        await updateMemo(memoInput);
        setIsEditingMemo(false);
    }, [memoInput, updateMemo]);

    const handleSaveSkiResort = useCallback(
        async (name: string | null) => {
            await updateSkiResort(name);
        },
        [updateSkiResort]
    );

    const handleSaveTags = useCallback(async () => {
        await updateTags(tagIdInput);
        setIsEditingTags(false);
    }, [tagIdInput, updateTags]);

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        try {
            await exportAllToJSON();
        } catch (e) {
            Alert.alert("書き出し失敗", e instanceof Error ? e.message : "エラーが発生しました");
        } finally {
            setIsExporting(false);
        }
    }, []);

    if (isLoading || !video) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>読み込み中...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {/* 動画プレイヤーの代わりにプレースホルダー */}
                <View style={styles.videoPlaceholder}>
                    <Text style={styles.videoPlaceholderIcon}>▶</Text>
                    <Text style={styles.videoPlaceholderText}>
                        動画再生はiOSアプリでご利用ください
                    </Text>
                </View>

                {/* メタデータ */}
                <View style={styles.metaSection}>
                    <Text style={styles.filename} numberOfLines={1}>
                        {video.filename}
                    </Text>
                    <Text style={styles.metaRow}>
                        📅 {formatDate(video.capturedAt)}　⏱ {formatDuration(video.duration)}
                    </Text>

                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>スキー場</Text>
                        <SkiResortSearch
                            value={video.skiResortName}
                            onSelect={handleSaveSkiResort}
                        />
                    </View>
                </View>

                {/* タグ */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>タグ</Text>
                        <TouchableOpacity onPress={() => setIsEditingTags(!isEditingTags)}>
                            <Text style={styles.editLink}>{isEditingTags ? "完了" : "編集"}</Text>
                        </TouchableOpacity>
                    </View>

                    {isEditingTags ? (
                        <>
                            <TagSelector
                                selectedTagIds={tagIdInput}
                                onChange={setTagIdInput}
                            />
                            <TouchableOpacity style={styles.saveTagButton} onPress={handleSaveTags}>
                                <Text style={styles.saveTagButtonText}>タグを保存</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={styles.tagList}>
                            {video.tags.length > 0 ? (
                                video.tags.map((tag) => <TagChip key={tag.id} tag={tag} />)
                            ) : (
                                <Text style={styles.emptyTag}>タグなし</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* メモ */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>メモ</Text>
                        <TouchableOpacity
                            onPress={() => {
                                if (isEditingMemo) {
                                    handleSaveMemo();
                                } else {
                                    setIsEditingMemo(true);
                                }
                            }}
                        >
                            <Text style={styles.editLink}>{isEditingMemo ? "保存" : "編集"}</Text>
                        </TouchableOpacity>
                    </View>

                    {isEditingMemo ? (
                        <TextInput
                            style={styles.memoInput}
                            value={memoInput}
                            onChangeText={setMemoInput}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            autoFocus
                        />
                    ) : (
                        <Text style={styles.memoText}>
                            {video.memo || "メモなし"}
                        </Text>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: "#888888",
        fontSize: 14,
    },
    scroll: {
        paddingBottom: 40,
    },
    videoPlaceholder: {
        width: "100%",
        height: 240,
        backgroundColor: "#2C2C2C",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
    },
    videoPlaceholderIcon: {
        fontSize: 40,
        color: "#FFFFFF",
        opacity: 0.4,
    },
    videoPlaceholderText: {
        color: "#AAAAAA",
        fontSize: 13,
    },
    metaSection: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        marginBottom: 8,
    },
    filename: {
        fontSize: 16,
        fontWeight: "700",
        color: "#222222",
        marginBottom: 4,
    },
    metaRow: {
        fontSize: 13,
        color: "#666666",
        marginBottom: 12,
    },
    fieldSection: {
        marginTop: 4,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#555555",
        marginBottom: 6,
    },
    section: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#222222",
    },
    editLink: {
        fontSize: 14,
        color: "#1A3A5C",
        fontWeight: "600",
    },
    tagList: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    emptyTag: {
        fontSize: 14,
        color: "#AAAAAA",
    },
    saveTagButton: {
        marginTop: 12,
        backgroundColor: "#1A3A5C",
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: "center",
    },
    saveTagButtonText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
    },
    memoInput: {
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 8,
        padding: 10,
        fontSize: 15,
        minHeight: 120,
        lineHeight: 22,
        backgroundColor: "#FAFAFA",
    },
    memoText: {
        fontSize: 15,
        color: "#333333",
        lineHeight: 22,
    },
});
