import { VideoView, useVideoPlayer } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isSyntheticAssetId } from "@/services/mediaService";
import {
    Alert,
    InputAccessoryView,
    Keyboard,
    KeyboardAvoidingView,
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
import Animated from "react-native-reanimated";

import { Colors } from "@/constants/colors";
import { LAYOUT_SPRING } from "@/constants/motion";
import { IconNames } from "@/constants/icons";
import { Icon } from "@/components/ui/Icon";
import { SkiResortSearch } from "@/components/SkiResortSearch";
import { TagSelector } from "@/components/TagSelector";
import { TechniqueSelector } from "@/components/TechniqueSelector";
import { useAutosavedText } from "@/hooks/useAutosavedText";
import { usePlaybackSource } from "@/hooks/usePlaybackSource";
import { useVideoDetail } from "@/hooks/useVideoDetail";
import { useSkiResortSuggestions } from "@/hooks/useSkiResortSuggestions";
import { useTranslation } from "@/i18n/useTranslation";
import { formatDateTime, formatDuration, formatDurationDecimal } from "@/utils/dateUtils";

const MEMO_INPUT_ACCESSORY_ID = "video-detail-memo-accessory";

/** セクション間の薄いディバイダー */
function SectionDivider() {
    return <Animated.View layout={LAYOUT_SPRING} style={styles.divider} />;
}

/**
 * 動画詳細画面
 * 動画再生・メタデータ表示・メモ編集・タグ編集を提供する
 */
export default function VideoDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { t, locale } = useTranslation();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const { video, isLoading, error, refresh, updateTitle, updateTechniques, updateMemo, updateSkiResort, updateTags, toggleFavorite, removeVideo } = useVideoDetail(id);
    const resortSuggestionGroups = useSkiResortSuggestions({
        capturedAt: video?.capturedAt ?? null,
        excludeVideoId: video?.id,
        currentValue: video?.skiResortName,
    });

    const scrollViewRef = useRef<ScrollView>(null);
    const shouldScrollMemoIntoViewRef = useRef(false);
    const memoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // タイトルとメモは入力から 1 秒後に自動保存する。予約した保存は、予約した描画時点の
    // updateTitle / updateMemo（＝そのとき表示していた動画）に書く
    const {
        value: titleInput,
        status: titleSaveStatus,
        onChangeText: handleTitleChange,
        seed: seedTitle,
        flush: flushTitleSave,
        cancel: cancelTitleSave,
    } = useAutosavedText((text) => updateTitle(text.trim() || null));
    const {
        value: memoInput,
        status: memoSaveStatus,
        onChangeText: handleMemoChange,
        seed: seedMemo,
        flush: flushMemoSave,
        cancel: cancelMemoSave,
    } = useAutosavedText((text) => updateMemo(text));
    const [tagIds, setTagIds] = useState<number[]>([]);
    const { videoUri, assetInfoMeta, accessBlocked } = usePlaybackSource(video, refresh);

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

    const clearMemoScrollTimer = useCallback(() => {
        if (memoScrollTimerRef.current) {
            clearTimeout(memoScrollTimerRef.current);
            memoScrollTimerRef.current = null;
        }
    }, []);

    const scrollMemoInputIntoView = useCallback(() => {
        if (!shouldScrollMemoIntoViewRef.current) {
            return;
        }

        clearMemoScrollTimer();
        memoScrollTimerRef.current = setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
            memoScrollTimerRef.current = null;
        }, Platform.OS === "ios" ? 250 : 100);
    }, [clearMemoScrollTimer]);

    useEffect(() => {
        const keyboardShowSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            scrollMemoInputIntoView
        );

        return () => {
            keyboardShowSubscription.remove();
            clearMemoScrollTimer();
        };
    }, [clearMemoScrollTimer, scrollMemoInputIntoView]);

    const handleMemoFocus = useCallback(() => {
        shouldScrollMemoIntoViewRef.current = true;
        scrollMemoInputIntoView();
    }, [scrollMemoInputIntoView]);

    const handleMemoBlur = useCallback(() => {
        shouldScrollMemoIntoViewRef.current = false;
        clearMemoScrollTimer();
    }, [clearMemoScrollTimer]);

    // The video whose title and memo the inputs were last seeded from.
    const seededVideoIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!video) return;
        // technique タグは TechniqueSelector で管理するため除外する
        setTagIds(video.tags.filter((t) => t.type !== "technique").map((t) => t.id));

        // Seed the text inputs only when a different video loads. A refetch after
        // a save (favourite, tags, the other field's autosave) must not overwrite
        // what the user is typing.
        if (seededVideoIdRef.current === video.id) return;
        // Pending edits belong to the previous video; save them before replacing
        // the inputs. A no-op on first load.
        flushTitleSave();
        flushMemoSave();
        seededVideoIdRef.current = video.id;
        seedTitle(video.title ?? "");
        seedMemo(video.memo);
    }, [video, flushTitleSave, flushMemoSave, seedTitle, seedMemo]);

    /** 動画レコードを削除する（確認ダイアログ付き） */
    const handleDelete = useCallback(() => {
        Alert.alert(
            t("videoDetail.deleteConfirm.title"),
            t("videoDetail.deleteConfirm.body"),
            [
                { text: t("common.cancel"), style: "cancel" },
                {
                    text: t("common.delete"),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await removeVideo();
                        } catch {
                            // 行は残っている。保留中の編集もまだ生きているので、そのまま保存される
                            Alert.alert(
                                t("home.swipeDelete.deleteFailedTitle"),
                                t("home.swipeDelete.deleteFailedBody")
                            );
                            return;
                        }
                        // 消えた行への保存は捨てる。削除の前に取り消すと、削除が失敗したときに
                        // 入力欄には残っているのに保存されない編集ができる
                        cancelTitleSave();
                        cancelMemoSave();
                        router.back();
                    },
                },
            ]
        );
    }, [removeVideo, router, t, cancelTitleSave, cancelMemoSave]);

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
        const parts: string[] = [formatDateTime(video.capturedAt, locale)];
        if (assetInfoMeta) {
            parts.push(formatDurationDecimal(assetInfoMeta.duration, locale));
            parts.push(`${assetInfoMeta.width}×${assetInfoMeta.height}`);
        } else {
            parts.push(formatDuration(video.duration, locale));
        }
        return parts.join("  ·  ");
    }, [video, assetInfoMeta, locale]);

    if (isLoading) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>{t("common.loading")}</Text>
            </View>
        );
    }

    if (error || !video) {
        return (
            <View style={styles.center}>
                <Text style={styles.loadingText}>{error ?? t("videoDetail.notFound")}</Text>
            </View>
        );
    }


    const canOpenPhotosApp =
        Platform.OS === "ios" && video.isFileAvailable === 1 && !isSyntheticAssetId(video.assetId);
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                ref={scrollViewRef}
                automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
                contentContainerStyle={styles.scroll}
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                keyboardShouldPersistTaps="handled"
            >
                {/* 動画プレイヤーエリア（ラッパーを永続させ、高さ変化を layout transition で遷移させる） */}
                <Animated.View layout={LAYOUT_SPRING}>
                    {accessBlocked ? (
                        <View style={styles.accessBlockedPanel}>
                            <Text style={styles.unavailableText}>
                                {t("permissions.photoLibraryPlaybackRequired.title")}
                            </Text>
                            <Text style={styles.accessBlockedBody}>
                                {t("permissions.photoLibraryPlaybackRequired.body")}
                            </Text>
                            <TouchableOpacity
                                onPress={() => Linking.openSettings()}
                                accessibilityRole="button"
                                style={styles.accessBlockedButton}
                            >
                                <Text style={styles.accessBlockedButtonText}>
                                    {t("common.openSettings")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : video.isFileAvailable === 1 && videoUri ? (
                        <VideoPlayerView
                            uri={videoUri}
                            style={{ width: "100%", height: playerHeight, backgroundColor: "#000000" }}
                        />
                    ) : video.isFileAvailable !== 1 ? (
                        <View style={styles.unavailableBanner}>
                            <Text style={styles.unavailableText}>
                                {t("videoDetail.fileMissing")}
                            </Text>
                        </View>
                    ) : (
                        <View style={{ width: "100%", height: playerHeight, backgroundColor: "#000000" }} />
                    )}
                </Animated.View>

                {/* メタデータ */}
                <Animated.View layout={LAYOUT_SPRING} style={styles.metaSection}>
                    {/* タイトル（編集可能・未設定時はfilenameをplaceholderとして表示） */}
                    <View style={styles.titleRow}>
                        <TextInput
                            style={styles.titleInput}
                            value={titleInput}
                            onChangeText={handleTitleChange}
                            placeholder={video.filename}
                            placeholderTextColor={Colors.textTertiary}
                            returnKeyType="done"
                            numberOfLines={1}
                        />
                        <TouchableOpacity
                            onPress={toggleFavorite}
                            hitSlop={8}
                            style={styles.starButton}
                            accessibilityRole="button"
                            accessibilityState={{ selected: video.isFavorite === 1 }}
                        >
                            <Icon
                                name={video.isFavorite === 1 ? IconNames.starFill : IconNames.starOutline}
                                size={30}
                                color={video.isFavorite === 1 ? Colors.morningGold : Colors.textTertiary}
                                fallback={video.isFavorite === 1 ? "★" : "☆"}
                                accessibilityLabel={t(
                                    video.isFavorite === 1
                                        ? "a11y.iconFavorite"
                                        : "a11y.iconNotFavorite"
                                )}
                            />
                        </TouchableOpacity>
                        <Text style={styles.saveStatus}>
                            {titleSaveStatus === "saving"
                                ? t("videoDetail.saveStatus.saving")
                                : titleSaveStatus === "saved"
                                  ? t("videoDetail.saveStatus.saved")
                                  : ""}
                        </Text>
                    </View>

                    {/* メタ行 + 写真アプリリンク */}
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText} numberOfLines={1}>
                            {metaLine}
                        </Text>
                        {canOpenPhotosApp && (
                            <TouchableOpacity
                                onPress={async () => {
                                    try {
                                        await Linking.openURL("photos-redirect://");
                                    } catch {
                                        Alert.alert(
                                            t("videoDetail.photosOpenFailed.title"),
                                            t("videoDetail.photosOpenFailed.body")
                                        );
                                    }
                                }}
                                hitSlop={8}
                                accessibilityRole="button"
                            >
                                <Text style={styles.photosLink}>{t("videoDetail.openPhotos")}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* スキー場名（編集可能） */}
                    <View style={styles.fieldSection}>
                        <Text style={styles.fieldLabel}>{t("videoDetail.skiResortLabel")}</Text>
                        <SkiResortSearch
                            value={video.skiResortName}
                            onSelect={handleSaveSkiResort}
                            suggestionGroups={resortSuggestionGroups}
                        />
                    </View>
                </Animated.View>

                <SectionDivider />

                {/* 滑走種別 */}
                <Animated.View layout={LAYOUT_SPRING} style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("videoDetail.techniquesLabel")}</Text>
                    <TechniqueSelector
                        selected={video.techniques ?? []}
                        onChange={updateTechniques}
                    />
                </Animated.View>

                <SectionDivider />

                {/* タグ（自動保存） */}
                <Animated.View layout={LAYOUT_SPRING} style={styles.section}>
                    <Text style={styles.sectionTitle}>{t("videoDetail.tagsLabel")}</Text>
                    <TagSelector
                        selectedTagIds={tagIds}
                        onChange={handleTagsChange}
                    />
                </Animated.View>

                <SectionDivider />

                {/* メモ（自動保存） */}
                <Animated.View layout={LAYOUT_SPRING} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t("videoDetail.memoLabel")}</Text>
                        <Text style={styles.saveStatus}>
                            {memoSaveStatus === "saving"
                                ? t("videoDetail.saveStatus.saving")
                                : memoSaveStatus === "saved"
                                  ? t("videoDetail.saveStatus.saved")
                                  : ""}
                        </Text>
                    </View>

                    <TextInput
                        style={styles.memoInput}
                        value={memoInput}
                        onChangeText={handleMemoChange}
                        placeholder={t("videoDetail.memoPlaceholder")}
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        inputAccessoryViewID={Platform.OS === "ios" ? MEMO_INPUT_ACCESSORY_ID : undefined}
                        onFocus={handleMemoFocus}
                        onBlur={handleMemoBlur}
                    />
                </Animated.View>

                {/* 削除ボタン */}
                <Animated.View layout={LAYOUT_SPRING}>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDelete}
                        accessibilityRole="button"
                    >
                        <Text style={styles.deleteButtonText}>{t("videoDetail.deleteRecord")}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
            {Platform.OS === "ios" && (
                <InputAccessoryView nativeID={MEMO_INPUT_ACCESSORY_ID}>
                    <View style={styles.keyboardAccessory}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t("common.done")}
                            onPress={() => Keyboard.dismiss()}
                            style={styles.keyboardAccessoryButton}
                        >
                            <Text style={styles.keyboardAccessoryButtonText}>{t("common.done")}</Text>
                        </TouchableOpacity>
                    </View>
                </InputAccessoryView>
            )}
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
        paddingBottom: 96,
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
    accessBlockedPanel: {
        paddingVertical: 20,
        paddingHorizontal: 24,
        gap: 8,
        backgroundColor: Colors.alpineBlueDark,
        alignItems: "center",
    },
    accessBlockedBody: {
        color: Colors.headerText,
        fontSize: 13,
        opacity: 0.8,
        textAlign: "center",
    },
    accessBlockedButton: {
        marginTop: 4,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: Colors.alpineBlue,
    },
    accessBlockedButtonText: {
        color: Colors.headerText,
        fontSize: 13,
        fontWeight: "600",
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
    keyboardAccessory: {
        minHeight: 44,
        paddingHorizontal: 12,
        alignItems: "flex-end",
        justifyContent: "center",
        backgroundColor: Colors.glacierWhite,
        borderTopWidth: 1,
        borderTopColor: Colors.borderLight,
    },
    keyboardAccessoryButton: {
        minHeight: 36,
        paddingHorizontal: 12,
        justifyContent: "center",
    },
    keyboardAccessoryButtonText: {
        color: Colors.alpineBlue,
        fontSize: 16,
        fontWeight: "700",
    },
    starButton: {
        width: 44,
        height: 44,
        marginLeft: 4,
        alignItems: "center",
        justifyContent: "center",
    },
});

