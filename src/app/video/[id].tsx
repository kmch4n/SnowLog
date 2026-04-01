import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAssetInfoWithDownload, requestMediaPermissions } from "@/services/mediaService";
import { updateFileAvailability } from "@/database/repositories/videoRepository";
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
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
import { TechniqueSelector } from "@/components/TechniqueSelector";
import { useVideoDetail } from "@/hooks/useVideoDetail";
import { formatDateTime, formatDuration, formatDurationDecimal } from "@/utils/dateUtils";

/**
 * 動画詳細画面
 * 動画再生・メタデータ表示・メモ編集・タグ編集を提供する
 */
export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { video, isLoading, error, refresh, updateTitle, updateTechniques, updateMemo, updateSkiResort, updateTags, removeVideo } = useVideoDetail(id);

    const [titleInput, setTitleInput] = useState("");
    const [titleSaveStatus, setTitleSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [memoInput, setMemoInput] = useState("");
    const [memoSaveStatus, setMemoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [tagIdInput, setTagIdInput] = useState<number[]>([]);
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [assetInfoMeta, setAssetInfoMeta] = useState<{
        width: number;
        height: number;
        duration: number;
    } | null>(null);

    // タイトル自動保存用の debounce タイマー
    const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInitialTitleLoad = useRef(true);

    // メモ自動保存用の debounce タイマー
    const memoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInitialMemoLoad = useRef(true);

    // タイトルが変更されたら1秒後に自動保存
    useEffect(() => {
        if (isInitialTitleLoad.current) {
            isInitialTitleLoad.current = false;
            return;
        }

        if (titleTimerRef.current) {
            clearTimeout(titleTimerRef.current);
        }

        setTitleSaveStatus("idle");
        titleTimerRef.current = setTimeout(async () => {
            setTitleSaveStatus("saving");
            await updateTitle(titleInput.trim() || null);
            setTitleSaveStatus("saved");
            setTimeout(() => setTitleSaveStatus("idle"), 2000);
        }, 1000);

        return () => {
            if (titleTimerRef.current) {
                clearTimeout(titleTimerRef.current);
            }
        };
    }, [titleInput]);

    // メモが変更されたら1秒後に自動保存
    useEffect(() => {
        // 初回ロード時（video.memo → memoInput への同期）は保存しない
        if (isInitialMemoLoad.current) {
            isInitialMemoLoad.current = false;
            return;
        }

        if (memoTimerRef.current) {
            clearTimeout(memoTimerRef.current);
        }

        setMemoSaveStatus("idle");
        memoTimerRef.current = setTimeout(async () => {
            setMemoSaveStatus("saving");
            await updateMemo(memoInput);
            setMemoSaveStatus("saved");
            // 2秒後にステータスをリセット
            setTimeout(() => setMemoSaveStatus("idle"), 2000);
        }, 1000);

        return () => {
            if (memoTimerRef.current) {
                clearTimeout(memoTimerRef.current);
            }
        };
    }, [memoInput]);

    useEffect(() => {
        if (!video) return;
        isInitialTitleLoad.current = true;
        setTitleInput(video.title ?? "");
        isInitialMemoLoad.current = true;
        setMemoInput(video.memo);
        // technique タグは TechniqueSelector で管理するため除外する
        setTagIdInput(video.tags.filter((t) => t.type !== "technique").map((t) => t.id));

        setAssetInfoMeta(null);

        // 元ファイルが存在する場合のみ再生用 URI を取得する
        if (video.isFileAvailable === 1) {
            (async () => {
                try {
                    const granted = await requestMediaPermissions();
                    if (!granted) {
                        // 権限拒否は一時的な状態であり、ファイル欠損ではない
                        Alert.alert(
                            "写真ライブラリへのアクセスが必要です",
                            "動画を再生するには、設定からアクセスを許可してください。",
                            [
                                { text: "キャンセル", style: "cancel" },
                                { text: "設定を開く", onPress: () => Linking.openSettings() },
                            ]
                        );
                        return;
                    }
                    // iCloud 専用アセットの場合は自動ダウンロードでリトライする
                    const info = await getAssetInfoWithDownload(video.assetId);
                    if (info?.uri || info?.localUri) {
                        // 再生には Photos フレームワークの uri (ph://) を優先利用する
                        setVideoUri(info.uri ?? info.localUri);
                        setAssetInfoMeta({ width: info.width, height: info.height, duration: info.duration });
                    } else {
                        await updateFileAvailability(video.id, false);
                        refresh();
                    }
                } catch {
                    // 一時的エラー（iCloud・ネットワーク等）の可能性があるため
                    // DB の isFileAvailable は更新しない
                }
            })();
        }
    }, [video]);

    /** 動画レコードを削除する（確認ダイアログ付き） */
    const handleDelete = useCallback(() => {
        Alert.alert(
            "動画を削除",
            "この動画の記録を削除しますか？\n（元の動画ファイルは削除されません）",
            [
                { text: "キャンセル", style: "cancel" },
                {
                    text: "削除",
                    style: "destructive",
                    onPress: async () => {
                        await removeVideo();
                        router.back();
                    },
                },
            ]
        );
    }, [removeVideo, router]);

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

    if (isLoading) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>読み込み中...</Text>
            </View>
        );
    }

    if (error || !video) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>{error ?? "動画が見つかりません"}</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll}>
                {/* 動画プレイヤーエリア */}
                {video.isFileAvailable === 1 && videoUri ? (
                    <VideoPlayerView uri={videoUri} style={styles.videoPlayer} />
                ) : video.isFileAvailable !== 1 ? (
                    <View style={styles.unavailableBanner}>
                        <Text style={styles.unavailableText}>
                            元の動画ファイルが見つかりません
                        </Text>
                    </View>
                ) : (
                    <View style={styles.videoPlayer} />
                )}

                {/* メタデータ */}
                <View style={styles.metaSection}>
                    {/* タイトル（編集可能・未設定時はfilenameをplaceholderとして表示） */}
                    <View style={styles.titleRow}>
                        <TextInput
                            style={styles.titleInput}
                            value={titleInput}
                            onChangeText={setTitleInput}
                            placeholder={video.filename}
                            placeholderTextColor="#AAAAAA"
                            returnKeyType="done"
                            numberOfLines={1}
                        />
                        <Text style={styles.saveStatus}>
                            {titleSaveStatus === "saving"
                                ? "保存中..."
                                : titleSaveStatus === "saved"
                                  ? "保存済み"
                                  : ""}
                        </Text>
                    </View>
                    <Text style={styles.metaRow}>
                        📅 {formatDateTime(video.capturedAt)}
                    </Text>
                    <Text style={styles.metaRow}>
                        ⏱{" "}
                        {assetInfoMeta
                            ? formatDurationDecimal(assetInfoMeta.duration)
                            : formatDuration(video.duration)}
                        {assetInfoMeta
                            ? `　📐 ${assetInfoMeta.width} × ${assetInfoMeta.height}`
                            : ""}
                    </Text>

                    {/* スキー場名（編集可能） */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>スキー場</Text>
                        <SkiResortSearch
                            value={video.skiResortName}
                            onSelect={handleSaveSkiResort}
                        />
                    </View>
                </View>

                {/* 滑走種別 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>滑走種別</Text>
                    <TechniqueSelector
                        selected={video.techniques ?? []}
                        onChange={updateTechniques}
                    />
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
                            {video.tags.filter((t) => t.type !== "technique").length > 0 ? (
                                video.tags
                                    .filter((t) => t.type !== "technique")
                                    .map((tag) => <TagChip key={tag.id} tag={tag} />)
                            ) : (
                                <Text style={styles.emptyTag}>タグなし</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* メモ（自動保存） */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>メモ</Text>
                        <Text style={styles.saveStatus}>
                            {memoSaveStatus === "saving"
                                ? "保存中..."
                                : memoSaveStatus === "saved"
                                  ? "保存済み"
                                  : ""}
                        </Text>
                    </View>

                    <TextInput
                        style={styles.memoInput}
                        value={memoInput}
                        onChangeText={setMemoInput}
                        placeholder="振り返りメモを入力..."
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                    />
                </View>

                {/* 写真アプリを開くボタン（ファイルが存在する場合のみ） */}
                {video.isFileAvailable === 1 && (
                    <TouchableOpacity
                        style={styles.openInPhotosButton}
                        onPress={async () => {
                            try {
                                await Linking.openURL("photos-redirect://");
                            } catch {
                                Alert.alert(
                                    "写真アプリを開けません",
                                    "写真アプリへのアクセスが利用できません。"
                                );
                            }
                        }}
                    >
                        <Text style={styles.openInPhotosButtonText}>写真アプリを開く</Text>
                    </TouchableOpacity>
                )}

                {/* 削除ボタン */}
                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                    <Text style={styles.deleteButtonText}>この動画の記録を削除</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

/** videoUri が確定してから useVideoPlayer を呼ぶためのラッパーコンポーネント */
function VideoPlayerView({ uri, style }: { uri: string; style: object }) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
    });
    return <VideoView player={player} style={style} nativeControls />;
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
    videoPlayer: {
        width: "100%",
        height: 240,
        backgroundColor: "#000000",
    },
    unavailableBanner: {
        height: 80,
        backgroundColor: "#424242",
        justifyContent: "center",
        alignItems: "center",
    },
    unavailableText: {
        color: "#FFFFFF",
        fontSize: 14,
    },
    metaSection: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        marginBottom: 8,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    titleInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: "700",
        color: "#222222",
        padding: 0,
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
    saveStatus: {
        fontSize: 12,
        color: "#888888",
    },
    openInPhotosButton: {
        marginHorizontal: 16,
        marginTop: 8,
        paddingVertical: 14,
        alignItems: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#1A3A5C",
    },
    openInPhotosButtonText: {
        fontSize: 14,
        color: "#1A3A5C",
        fontWeight: "600",
    },
    deleteButton: {
        marginHorizontal: 16,
        marginTop: 8,
        paddingVertical: 14,
        alignItems: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    deleteButtonText: {
        fontSize: 14,
        color: "#CC3333",
        fontWeight: "600",
    },
});
