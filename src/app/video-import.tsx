import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { Colors } from "@/constants/colors";
import { SkiResortSearch } from "@/components/SkiResortSearch";
import { TagSelector } from "@/components/TagSelector";
import { TechniqueSelector } from "@/components/TechniqueSelector";
import { getVideoByAssetId } from "@/database/repositories/videoRepository";
import { importVideo } from "@/services/importService";
import { getAssetInfoWithDownload } from "@/services/mediaService";
import { formatDate, formatDuration, parseExifDateTime } from "@/utils/dateUtils";
import { findNearbySkiResorts } from "@/utils/geoUtils";
import * as FileSystem from "expo-file-system/legacy";

const IMPORT_CACHE_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}video-import/`;

async function ensureImportCacheDir(): Promise<void> {
    if (!IMPORT_CACHE_DIR) return;
    const info = await FileSystem.getInfoAsync(IMPORT_CACHE_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(IMPORT_CACHE_DIR, { intermediates: true });
    }
}

function inferExtension(filename?: string | null, uri?: string | null): string {
    const target = filename ?? uri ?? "";
    const match = target.match(/\.([a-zA-Z0-9]+)(?:$|\?)/);
    return match ? match[1].toLowerCase() : "mov";
}

async function stageAssetFile(sourceUri: string, filename?: string | null): Promise<string> {
    if (!sourceUri.startsWith("file://") || !IMPORT_CACHE_DIR) {
        throw new Error("ファイルを読み込めませんでした。");
    }
    await ensureImportCacheDir();
    const dest = `${IMPORT_CACHE_DIR}${Date.now()}-${Math.random().toString(36).slice(2)}.${inferExtension(
        filename,
        sourceUri
    )}`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
}

/**
 * 動画インポート画面（モーダル）
 *
 * 流れ:
 * 1. カメラロールから動画を選択
 * 2. サムネイル・日時を自動取得
 * 3. スキー場名・タグ・メモを入力
 * 4. 保存
 */
export default function VideoImportScreen() {
    const router = useRouter();

    const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [title, setTitle] = useState("");
    const [skiResortName, setSkiResortName] = useState<string | null>(null);
    const [techniques, setTechniques] = useState<string[]>([]);
    const [tagIds, setTagIds] = useState<number[]>([]);
    const [memo, setMemo] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [gpsSuggestions, setGpsSuggestions] = useState<
        { name: string; distanceKm: number }[]
    >([]);
    const [assetCreationTime, setAssetCreationTime] = useState<number | null>(null);
    const [resolvedAssetUri, setResolvedAssetUri] = useState<string | null>(null);
    const [isLoadingMeta, setIsLoadingMeta] = useState(false);
    const stagedFileUriRef = useRef<string | null>(null);

    const cleanupStagedFile = useCallback(async () => {
        if (stagedFileUriRef.current) {
            try {
                await FileSystem.deleteAsync(stagedFileUriRef.current, { idempotent: true });
            } catch {
                // noop
            }
            stagedFileUriRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            cleanupStagedFile();
        };
    }, [cleanupStagedFile]);

    const stageForImport = useCallback(
        async (sourceUri: string | null, filename?: string | null): Promise<string | null> => {
            if (!sourceUri) return null;
            if (!sourceUri.startsWith("file://")) return null;
            const staged = await stageAssetFile(sourceUri, filename);
            stagedFileUriRef.current = staged;
            return staged;
        },
        []
    );

    /** カメラロールから動画を選択する */
    const handlePickVideo = useCallback(async () => {
        const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permResult.granted) {
            Alert.alert(
                "権限が必要です",
                "フォトライブラリへのアクセスを許可してください。"
            );
            return;
        }

        let pickerResult: ImagePicker.ImagePickerResult;
        try {
            pickerResult = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["videos"],
                allowsEditing: false,
                quality: 1,
                exif: true, // GPS フィールドを含む EXIF を取得
                shouldDownloadFromNetwork: true,
                videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : typeof error === "string"
                        ? error
                        : "不明なエラーが発生しました。";
            if (message.includes("3164")) {
                Alert.alert(
                    "iCloud 動画を取得できませんでした",
                    "ネットワークに接続されているか確認して、もう一度お試しください。"
                );
            } else {
                Alert.alert("動画の選択に失敗しました", message);
            }
            return;
        }

        if (pickerResult.canceled || pickerResult.assets.length === 0) return;

        const asset = pickerResult.assets[0];
        if (!asset) return;

        // 既にインポート済みかチェック
        if (asset.assetId) {
            const existing = await getVideoByAssetId(asset.assetId);
            if (existing) {
                Alert.alert(
                    "インポート済み",
                    "この動画は既にインポートされています。編集画面を開きますか？",
                    [
                        { text: "キャンセル", style: "cancel" },
                        {
                            text: "編集する",
                            onPress: () => router.replace(`/video/${existing.id}` as any),
                        },
                    ]
                );
                return;
            }
        }

        await cleanupStagedFile();
        setSelectedAsset(asset);
        setGpsSuggestions([]);
        setAssetCreationTime(null);
        setResolvedAssetUri(null);

        // MediaLibrary のメタデータから GPS 座標・撮影日時を取得
        // iCloud 専用アセットの場合は自動ダウンロードでリトライする
        let assetInfo: Awaited<ReturnType<typeof getAssetInfoWithDownload>> | null = null;
        if (asset.assetId) {
            setIsLoadingMeta(true);
            try {
                assetInfo = await getAssetInfoWithDownload(asset.assetId);
                if (assetInfo?.creationTime && Number.isFinite(assetInfo.creationTime)) {
                    setAssetCreationTime(assetInfo.creationTime);
                }
                if (assetInfo?.location) {
                    setGpsSuggestions(
                        findNearbySkiResorts(assetInfo.location.latitude, assetInfo.location.longitude)
                    );
                }
            } catch {
                assetInfo = null;
            } finally {
                setIsLoadingMeta(false);
            }
        }

        let stagedUri: string | null = null;
        try {
            stagedUri = await stageForImport(assetInfo?.localUri ?? asset.uri ?? null, asset.fileName);
        } catch {
            stagedUri = null;
        }

        if (!stagedUri) {
            Alert.alert(
                "動画を読み込めませんでした",
                "iCloud からの取得に失敗しました。もう一度お試しください。"
            );
            setSelectedAsset(null);
            setResolvedAssetUri(null);
            return;
        }

        setResolvedAssetUri(stagedUri);
    }, [cleanupStagedFile, router, stageForImport]);

    /** 動画をインポートしてDBに保存する */
    const handleSave = useCallback(async () => {
        if (!selectedAsset) {
            Alert.alert("動画を選択してください");
            return;
        }
        if (!selectedAsset.assetId) {
            Alert.alert("エラー", "動画のアセットIDを取得できませんでした。");
            return;
        }
        if (!resolvedAssetUri) {
            Alert.alert(
                "動画を取得しています",
                "iCloud からのダウンロードが完了してから保存してください。"
            );
            return;
        }

        setIsSaving(true);
        try {
            // expo-image-picker の Asset を expo-media-library の Asset 形式に合わせる
            const mediaAsset = {
                id: selectedAsset.assetId,
                filename: selectedAsset.fileName ?? "video.mp4",
                creationTime: (selectedAsset.exif?.DateTimeOriginal
                    ? parseExifDateTime(selectedAsset.exif.DateTimeOriginal)
                    : null) ?? assetCreationTime ?? Date.now(),
                duration: (selectedAsset.duration ?? 0) / 1000,
                uri: resolvedAssetUri,
                localUri: resolvedAssetUri,
                width: selectedAsset.width,
                height: selectedAsset.height,
                mediaType: "video" as const,
                albumId: undefined,
            };

            await importVideo(
                mediaAsset as any,
                { title: title.trim() || null, skiResortName, memo, tagIds, techniques },
                { sourceUri: resolvedAssetUri }
            );

            await cleanupStagedFile();
            router.back();
        } catch (e) {
            Alert.alert(
                "インポートに失敗しました",
                e instanceof Error ? e.message : "不明なエラーが発生しました。"
            );
        } finally {
            setIsSaving(false);
        }
    }, [
        selectedAsset,
        assetCreationTime,
        resolvedAssetUri,
        title,
        skiResortName,
        memo,
        tagIds,
        techniques,
        router,
        cleanupStagedFile,
    ]);

    // 撮影日時を取得（EXIF → MediaLibrary creationTime の順でフォールバック）
    const creationMs = (selectedAsset?.exif?.DateTimeOriginal
        ? parseExifDateTime(selectedAsset.exif.DateTimeOriginal)
        : null) ?? assetCreationTime;
    const capturedAt = creationMs != null ? Math.floor(creationMs / 1000) : null;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
            >
                {/* 動画選択エリア */}
                <TouchableOpacity style={styles.pickButton} onPress={handlePickVideo}>
                    {selectedAsset ? (
                        <View style={styles.previewContainer}>
                            <Image
                                source={{ uri: selectedAsset.uri }}
                                style={styles.previewImage}
                                resizeMode="cover"
                            />
                            <View style={styles.previewMeta}>
                                <Text style={styles.previewFilename} numberOfLines={1}>
                                    {selectedAsset.fileName ?? "動画"}
                                </Text>
                                {capturedAt && (
                                    <Text style={styles.previewDate}>
                                        {formatDate(capturedAt)}
                                    </Text>
                                )}
                                {selectedAsset.duration != null && (
                                    <Text style={styles.previewDuration}>
                                        {formatDuration(Math.round(selectedAsset.duration / 1000))}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity style={styles.changeButton} onPress={handlePickVideo}>
                                <Text style={styles.changeButtonText}>変更</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.pickPlaceholder}>
                            <Text style={styles.pickIcon}>🎬</Text>
                            <Text style={styles.pickText}>タップして動画を選択</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* iCloud ダウンロード中のメタデータ取得インジケーター */}
                {isLoadingMeta && (
                    <View style={styles.metaLoading}>
                        <ActivityIndicator size="small" color={Colors.alpineBlue} />
                        <Text style={styles.metaLoadingText}>メタデータを取得中...</Text>
                    </View>
                )}

                {/* タイトル */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>タイトル</Text>
                    <TextInput
                        style={styles.titleInput}
                        value={title}
                        onChangeText={setTitle}
                        placeholder={selectedAsset?.fileName ?? "タイトルを入力..."}
                        placeholderTextColor={Colors.textTertiary}
                        returnKeyType="done"
                        numberOfLines={1}
                    />
                </View>

                {/* スキー場名 */}
                <View style={[styles.section, styles.resortSection]}>
                    <Text style={styles.sectionTitle}>スキー場</Text>
                    {/* GPS撮影地からのサジェスト（スキー場未設定かつ GPS検出成功時のみ表示） */}
                    {gpsSuggestions.length > 0 && !skiResortName && (
                        <View style={styles.gpsBanner}>
                            <Text style={styles.gpsBannerLabel}>📍 撮影地の近くのスキー場</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.gpsBannerChips}
                                keyboardShouldPersistTaps="always"
                            >
                                {gpsSuggestions.map((s) => (
                                    <TouchableOpacity
                                        key={s.name}
                                        style={styles.gpsBannerChip}
                                        onPress={() => {
                                            setSkiResortName(s.name);
                                            setGpsSuggestions([]);
                                        }}
                                    >
                                        <Text style={styles.gpsBannerChipName}>{s.name}</Text>
                                        <Text style={styles.gpsBannerChipDist}>{s.distanceKm.toFixed(1)} km</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                    <SkiResortSearch value={skiResortName} onSelect={setSkiResortName} />
                </View>

                {/* 滑走種別 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>滑走種別</Text>
                    <TechniqueSelector selected={techniques} onChange={setTechniques} />
                </View>

                {/* タグ */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>タグ</Text>
                    <View style={styles.tagSelectorContainer}>
                        <TagSelector selectedTagIds={tagIds} onChange={setTagIds} />
                    </View>
                </View>

                {/* メモ */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>メモ</Text>
                    <TextInput
                        style={styles.memoInput}
                        value={memo}
                        onChangeText={setMemo}
                        placeholder="振り返りメモを入力..."
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>

                {/* 保存ボタン */}
                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        (!selectedAsset || !resolvedAssetUri || isLoadingMeta) && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!selectedAsset || isSaving || !resolvedAssetUri || isLoadingMeta}
                >
                    {isSaving ? (
                        <ActivityIndicator color={Colors.headerText} />
                    ) : (
                        <Text style={styles.saveButtonText}>保存する</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    scroll: {
        padding: 16,
        paddingBottom: 40,
    },
    pickButton: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 12,
        marginBottom: 16,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: Colors.border,
        borderStyle: "dashed",
    },
    pickPlaceholder: {
        height: 160,
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
    },
    pickIcon: {
        fontSize: 36,
    },
    pickText: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    previewContainer: {
        flexDirection: "row",
        padding: 12,
        alignItems: "center",
        gap: 12,
    },
    previewImage: {
        width: 80,
        height: 60,
        borderRadius: 6,
        backgroundColor: Colors.border,
    },
    previewMeta: {
        flex: 1,
    },
    previewFilename: {
        fontSize: 14,
        fontWeight: "600",
        color: Colors.textPrimary,
    },
    previewDate: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    previewDuration: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    changeButton: {
        backgroundColor: Colors.frostGray,
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    changeButtonText: {
        fontSize: 13,
        color: Colors.textPrimary,
    },
    section: {
        marginBottom: 16,
    },
    resortSection: {
        zIndex: 300,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 8,
    },
    tagSelectorContainer: {
        minHeight: 120,
    },
    titleInput: {
        backgroundColor: Colors.freshSnow,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: Colors.textPrimary,
    },
    memoInput: {
        backgroundColor: Colors.freshSnow,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        minHeight: 100,
        lineHeight: 22,
    },
    gpsBanner: {
        backgroundColor: Colors.alpineBlueLight,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginBottom: 8,
    },
    gpsBannerLabel: {
        fontSize: 12,
        color: Colors.alpineBlue,
        fontWeight: "600",
        marginBottom: 6,
    },
    gpsBannerChips: {
        gap: 6,
    },
    gpsBannerChip: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: Colors.alpineBlue,
        alignItems: "center",
    },
    gpsBannerChipName: {
        fontSize: 13,
        color: Colors.alpineBlue,
        fontWeight: "600",
    },
    gpsBannerChipDist: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 1,
    },
    saveButton: {
        backgroundColor: Colors.alpineBlue,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 8,
    },
    metaLoading: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 8,
        marginBottom: 8,
    },
    metaLoadingText: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    saveButtonDisabled: {
        backgroundColor: Colors.textTertiary,
    },
    saveButtonText: {
        color: Colors.headerText,
        fontSize: 16,
        fontWeight: "700",
    },
});
