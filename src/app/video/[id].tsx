import { VideoView, useVideoPlayer } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAssetInfoWithDownload, isSyntheticAssetId, requestMediaPermissions } from "@/services/mediaService";
import { updateFileAvailability } from "@/database/repositories/videoRepository";
import {
    Alert,
    KeyboardAvoidingView,
    LayoutAnimation,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

import { Colors } from "@/constants/colors";
import { SkiResortSearch } from "@/components/SkiResortSearch";
import { TagSelector } from "@/components/TagSelector";
import { TechniqueSelector } from "@/components/TechniqueSelector";
import { useVideoDetail } from "@/hooks/useVideoDetail";
import { formatDateTime, formatDuration, formatDurationDecimal } from "@/utils/dateUtils";

/** セクション間の薄いディバイダー */
function SectionDivider() {
    return <View style={styles.divider} />;
}

/**
 * 動画詳細画面
 * 動画再生・メタデータ表示・メモ編集・タグ編集を提供する
 */
export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const { video, isLoading, error, refresh, updateTitle, updateTechniques, updateMemo, updateSkiResort, updateTags, toggleFavorite, removeVideo } = useVideoDetail(id);

    const [titleInput, setTitleInput] = useState("");
    const [titleSaveStatus, setTitleSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [memoInput, setMemoInput] = useState("");
    const [memoSaveStatus, setMemoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [tagIds, setTagIds] = useState<number[]>([]);
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [assetInfoMeta, setAssetInfoMeta] = useState<{
        width: number;
        height: number;
        duration: number;
    } | null>(null);

    // アスペクト比に基づく動的プレイヤー高さ
    const playerHeight = useMemo(() => {
        if (!assetInfoMeta) return 240;
        const aspectRatio = assetInfoMeta.width / assetInfoMeta.height;
        if (aspectRatio < 1) {
            // 縦動画: 画面高さの 65% を上限にキャップ
            return Math.min(screenWidth / aspectRatio, screenHeight * 0.65);
        }
        // 横動画・正方形: 幅に合わせる
        return screenWidth / aspectRatio;
    }, [assetInfoMeta, screenWidth, screenHeight]);

    // Stable refs for callbacks used inside debounce effects
    // (avoids adding them to deps, which would reset the debounce timer)
    const updateTitleRef = useRef(updateTitle);
    updateTitleRef.current = updateTitle;
    const updateMemoRef = useRef(updateMemo);
    updateMemoRef.current = updateMemo;
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

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
            await updateTitleRef.current(titleInput.trim() || null);
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
            await updateMemoRef.current(memoInput);
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
        setTagIds(video.tags.filter((t) => t.type !== "technique").map((t) => t.id));

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
                    // Synthetic assets have no MediaLibrary entry — mark unavailable
                    if (isSyntheticAssetId(video.assetId)) {
                        await updateFileAvailability(video.id, false);
                        refreshRef.current();
                        return;
                    }
                    // iCloud 専用アセットの場合は自動ダウンロードでリトライする
                    const info = await getAssetInfoWithDownload(video.assetId);
                    if (info?.uri || info?.localUri) {
                        // 高さ変更をアニメーションで滑らかに遷移
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        // 再生には Photos フレームワークの uri (ph://) を優先利用する
                        setVideoUri(info.uri ?? info.localUri);
                        setAssetInfoMeta({ width: info.width, height: info.height, duration: info.duration });
                    } else {
                        await updateFileAvailability(video.id, false);
                        refreshRef.current();
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

    /** タグ変更時に即座に保存する（滑走種別と同じパターン） */
    const handleTagsChange = useCallback(
        async (newTagIds: number[]) => {
            setTagIds(newTagIds);
            await updateTags(newTagIds);
        },
        [updateTags]
    );

    /** メタ情報を1行にまとめる（日付 · 時間 · 解像度） */
    const metaLine = useMemo(() => {
        if (!video) return "";
        const parts: string[] = [formatDateTime(video.capturedAt)];
        if (assetInfoMeta) {
            parts.push(formatDurationDecimal(assetInfoMeta.duration));
            parts.push(`${assetInfoMeta.width}×${assetInfoMeta.height}`);
        } else {
            parts.push(formatDuration(video.duration));
        }
        return parts.join("  ·  ");
    }, [video, assetInfoMeta]);

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
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">
                {/* 動画プレイヤーエリア */}
                {video.isFileAvailable === 1 && videoUri ? (
                    <VideoPlayerView
                        uri={videoUri}
                        style={{ width: "100%", height: playerHeight, backgroundColor: "#000000" }}
                    />
                ) : video.isFileAvailable !== 1 ? (
                    <View style={styles.unavailableBanner}>
                        <Text style={styles.unavailableText}>
                            元の動画ファイルが見つかりません
                        </Text>
                    </View>
                ) : (
                    <View style={{ width: "100%", height: playerHeight, backgroundColor: "#000000" }} />
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
                            placeholderTextColor={Colors.textTertiary}
                            returnKeyType="done"
                            numberOfLines={1}
                        />
                        <TouchableOpacity onPress={toggleFavorite} hitSlop={8}>
                            <Text style={video.isFavorite === 1 ? styles.starActive : styles.starInactive}>
                                {video.isFavorite === 1 ? "★" : "☆"}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.saveStatus}>
                            {titleSaveStatus === "saving"
                                ? "保存中..."
                                : titleSaveStatus === "saved"
                                  ? "保存済み"
                                  : ""}
                        </Text>
                    </View>

                    {/* メタ行 + 写真アプリリンク */}
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText} numberOfLines={1}>
                            {metaLine}
                        </Text>
                        {video.isFileAvailable === 1 && (
                            <TouchableOpacity
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
                                hitSlop={8}
                            >
                                <Text style={styles.photosLink}>写真アプリ ↗</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* スキー場名（編集可能） */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>スキー場</Text>
                        <SkiResortSearch
                            value={video.skiResortName}
                            onSelect={handleSaveSkiResort}
                        />
                    </View>
                </View>

                <SectionDivider />

                {/* 滑走種別 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>滑走種別</Text>
                    <TechniqueSelector
                        selected={video.techniques ?? []}
                        onChange={updateTechniques}
                    />
                </View>

                <SectionDivider />

                {/* タグ（自動保存） */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>タグ</Text>
                    <TagSelector
                        selectedTagIds={tagIds}
                        onChange={handleTagsChange}
                    />
                </View>

                <SectionDivider />

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
    const ref = useRef<VideoView>(null);
    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
    });
    return (
        <VideoView
            ref={ref}
            player={player}
            style={style}
            nativeControls
            contentFit="contain"
            fullscreenOptions={{
                enable: true,
                orientation: "default",
                autoExitOnRotate: true,
            }}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.freshSnow,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
    },
    loadingText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    scroll: {
        paddingBottom: 48,
    },
    unavailableBanner: {
        height: 80,
        backgroundColor: Colors.alpineBlueDark,
        justifyContent: "center",
        alignItems: "center",
    },
    unavailableText: {
        color: Colors.headerText,
        fontSize: 14,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.borderLight,
        marginHorizontal: 16,
    },
    metaSection: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    titleInput: {
        flex: 1,
        fontSize: 20,
        fontWeight: "800",
        color: Colors.textPrimary,
        padding: 0,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    metaText: {
        flex: 1,
        fontSize: 13,
        color: Colors.textSecondary,
    },
    photosLink: {
        fontSize: 13,
        color: Colors.alpineBlue,
        fontWeight: "600",
        marginLeft: 12,
    },
    fieldSection: {
        marginTop: 4,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: Colors.textSecondary,
        marginBottom: 6,
    },
    section: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: Colors.textSecondary,
        marginBottom: 10,
    },
    memoInput: {
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        minHeight: 120,
        lineHeight: 22,
        backgroundColor: Colors.glacierWhite,
    },
    saveStatus: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    deleteButton: {
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 16,
        paddingVertical: 12,
        alignItems: "center",
    },
    deleteButtonText: {
        fontSize: 13,
        color: Colors.textTertiary,
        fontWeight: "500",
    },
    starActive: {
        fontSize: 24,
        color: Colors.morningGold,
        marginLeft: 8,
    },
    starInactive: {
        fontSize: 24,
        color: Colors.textTertiary,
        marginLeft: 8,
    },
});
