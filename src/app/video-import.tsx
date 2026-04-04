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
import { BulkImportProgress } from "@/components/BulkImportProgress";
import { GpsConfirmationDialog } from "@/components/GpsConfirmationDialog";
import { SkiResortSearch } from "@/components/SkiResortSearch";
import { TagSelector } from "@/components/TagSelector";
import { TechniqueSelector } from "@/components/TechniqueSelector";
import {
    getExistingAssetIds,
    getVideoByAssetId,
    updateSkiResortForVideos,
} from "@/database/repositories/videoRepository";
import { importVideo } from "@/services/importService";
import { getAssetInfoWithDownload } from "@/services/mediaService";
import { randomUUID } from "expo-crypto";
import type { BulkImportGpsGroup, BulkImportItem } from "@/types";
import { formatDate, formatDateTime, formatDuration, parseExifDateTime } from "@/utils/dateUtils";
import { findNearbySkiResorts } from "@/utils/geoUtils";
import * as FileSystem from "expo-file-system/legacy";

const IMPORT_CACHE_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}video-import/`;
const BULK_SELECTION_LIMIT = 20;

type BulkPhase = "idle" | "importing" | "gps-confirm";

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

    // 一括インポート用 state
    const [bulkPhase, setBulkPhase] = useState<BulkPhase>("idle");
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
    const [bulkCurrentFilename, setBulkCurrentFilename] = useState<string | undefined>();
    const [bulkSkippedCount, setBulkSkippedCount] = useState(0);
    const [bulkErrorCount, setBulkErrorCount] = useState(0);
    const [bulkGpsGroups, setBulkGpsGroups] = useState<BulkImportGpsGroup[]>([]);
    const [bulkNoGpsCount, setBulkNoGpsCount] = useState(0);
    const [isApplyingGps, setIsApplyingGps] = useState(false);

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
        if (!resolvedAssetUri) {
            Alert.alert(
                "動画を取得しています",
                "iCloud からのダウンロードが完了してから保存してください。"
            );
            return;
        }

        setIsSaving(true);
        try {
            // Generate a synthetic assetId when the picker did not return one
            const effectiveAssetId = selectedAsset.assetId ?? `synthetic:${randomUUID()}`;

            // expo-image-picker の Asset を expo-media-library の Asset 形式に合わせる
            const mediaAsset = {
                id: effectiveAssetId,
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

    // ── 一括インポート ──

    /** GPS グループを構築する */
    const buildGpsGroups = useCallback((items: BulkImportItem[]): BulkImportGpsGroup[] => {
        const map = new Map<string, { distanceKm: number; videoIds: string[] }>();
        for (const item of items) {
            if (item.status === "success" && item.detectedResort && item.videoId) {
                const entry = map.get(item.detectedResort);
                if (entry) {
                    entry.videoIds.push(item.videoId);
                } else {
                    map.set(item.detectedResort, {
                        distanceKm: item.detectedResortDistance ?? 0,
                        videoIds: [item.videoId],
                    });
                }
            }
        }
        return Array.from(map.entries()).map(([resortName, data]) => ({
            resortName,
            distanceKm: data.distanceKm,
            videoIds: data.videoIds,
            confirmed: true,
        }));
    }, []);

    /** サマリー Alert を表示して画面を閉じる */
    const showBulkSummary = useCallback(
        (successCount: number, skippedCount: number, errorCount: number) => {
            const parts: string[] = [];
            parts.push(`${successCount}本インポートしました`);
            if (skippedCount > 0) parts.push(`スキップ: ${skippedCount}本`);
            if (errorCount > 0) parts.push(`エラー: ${errorCount}本`);

            Alert.alert("一括インポート完了", parts.join("\n"), [
                { text: "OK", onPress: () => router.back() },
            ]);
        },
        [router]
    );

    /** 一括インポートのコアロジック */
    const processBulkImport = useCallback(
        async (assets: ImagePicker.ImagePickerAsset[]) => {
            // 重複チェック
            const assetIds = assets
                .map((a) => a.assetId)
                .filter((id): id is string => id != null);
            const existingIds = await getExistingAssetIds(assetIds);

            // Map each item's resolved assetId back to its index in the assets array
            const assetIndexMap = new Map<string, number>();
            const items: BulkImportItem[] = assets.map((a, index) => {
                const id = a.assetId ?? `synthetic:${randomUUID()}`;
                assetIndexMap.set(id, index);
                return {
                    assetId: id,
                    filename: a.fileName ?? "video.mp4",
                    status: (a.assetId && existingIds.has(a.assetId)) ? "skipped" as const : "pending" as const,
                };
            });

            const skipped = items.filter((i) => i.status === "skipped").length;
            setBulkSkippedCount(skipped);

            const pendingItems = items.filter((i) => i.status === "pending");
            setBulkProgress({ current: 0, total: pendingItems.length });

            let errorCount = 0;

            for (let idx = 0; idx < pendingItems.length; idx++) {
                const item = pendingItems[idx];
                const asset = assets[assetIndexMap.get(item.assetId)!];
                item.status = "importing";
                setBulkCurrentFilename(item.filename);

                try {
                    // メタデータ取得（GPS + localUri）
                    let assetInfo: Awaited<ReturnType<typeof getAssetInfoWithDownload>> | null = null;
                    if (asset.assetId) {
                        try {
                            assetInfo = await getAssetInfoWithDownload(asset.assetId);
                        } catch {
                            assetInfo = null;
                        }
                    }

                    // ファイルをステージング
                    const sourceUri = assetInfo?.localUri ?? asset.uri ?? null;
                    if (!sourceUri || !sourceUri.startsWith("file://")) {
                        throw new Error("ファイルを読み込めませんでした。");
                    }
                    const stagedUri = await stageAssetFile(sourceUri, asset.fileName);

                    try {
                        // 撮影日時を解決
                        const creationTime =
                            (asset.exif?.DateTimeOriginal
                                ? parseExifDateTime(asset.exif.DateTimeOriginal)
                                : null) ??
                            assetInfo?.creationTime ??
                            Date.now();

                        const mediaAsset = {
                            id: item.assetId,
                            filename: asset.fileName ?? "video.mp4",
                            creationTime,
                            duration: (asset.duration ?? 0) / 1000,
                            uri: stagedUri,
                            localUri: stagedUri,
                            width: asset.width,
                            height: asset.height,
                            mediaType: "video" as const,
                            albumId: undefined,
                        };

                        const videoId = await importVideo(
                            mediaAsset as any,
                            {
                                title: null,
                                skiResortName: null,
                                memo: "",
                                tagIds: [],
                                techniques: [],
                            },
                            { sourceUri: stagedUri }
                        );

                        item.status = "success";
                        item.videoId = videoId;

                        // GPS スキー場検出
                        if (assetInfo?.location) {
                            const nearby = findNearbySkiResorts(
                                assetInfo.location.latitude,
                                assetInfo.location.longitude
                            );
                            if (nearby.length > 0) {
                                item.detectedResort = nearby[0].name;
                                item.detectedResortDistance = nearby[0].distanceKm;
                            }
                        }
                    } finally {
                        // ステージファイル即時削除（ディスク節約）
                        try {
                            await FileSystem.deleteAsync(stagedUri, { idempotent: true });
                        } catch {
                            // noop
                        }
                    }
                } catch (e) {
                    item.status = "error";
                    item.error = e instanceof Error ? e.message : "不明なエラー";
                    errorCount++;
                }

                setBulkProgress({ current: idx + 1, total: pendingItems.length });
                setBulkErrorCount(errorCount);
            }

            // GPS グループ構築
            const gpsGroups = buildGpsGroups(items);
            const successCount = items.filter((i) => i.status === "success").length;
            const noGpsCount = items.filter(
                (i) => i.status === "success" && !i.detectedResort
            ).length;

            if (gpsGroups.length > 0) {
                setBulkGpsGroups(gpsGroups);
                setBulkNoGpsCount(noGpsCount);
                setBulkPhase("gps-confirm");
            } else {
                // GPS 検出なし → サマリーを表示して戻る
                showBulkSummary(successCount, skipped, errorCount);
            }
        },
        [buildGpsGroups, showBulkSummary]
    );

    /** 複数動画を選択して一括インポートを開始する */
    const handlePickBulk = useCallback(async () => {
        const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permResult.granted) {
            Alert.alert("権限が必要です", "フォトライブラリへのアクセスを許可してください。");
            return;
        }

        let pickerResult: ImagePicker.ImagePickerResult;
        try {
            pickerResult = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["videos"],
                allowsMultipleSelection: true,
                selectionLimit: BULK_SELECTION_LIMIT,
                orderedSelection: true,
                exif: true,
                shouldDownloadFromNetwork: true,
                videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "不明なエラーが発生しました。";
            Alert.alert("動画の選択に失敗しました", message);
            return;
        }

        if (pickerResult.canceled || pickerResult.assets.length === 0) return;

        // 一括モード開始
        setBulkPhase("importing");
        setBulkProgress({ current: 0, total: 0 });
        setBulkSkippedCount(0);
        setBulkErrorCount(0);
        setBulkCurrentFilename(undefined);

        await processBulkImport(pickerResult.assets);
    }, [processBulkImport]);

    /** GPS グループのチェック状態をトグルする */
    const handleToggleGpsGroup = useCallback((resortName: string) => {
        setBulkGpsGroups((prev) =>
            prev.map((g) =>
                g.resortName === resortName ? { ...g, confirmed: !g.confirmed } : g
            )
        );
    }, []);

    /** GPS スキー場を適用して完了する */
    const handleGpsConfirm = useCallback(async () => {
        setIsApplyingGps(true);
        try {
            const confirmedGroups = bulkGpsGroups.filter((g) => g.confirmed);
            for (const group of confirmedGroups) {
                await updateSkiResortForVideos(group.videoIds, group.resortName);
            }
        } catch (e) {
            Alert.alert(
                "スキー場の設定に失敗しました",
                e instanceof Error ? e.message : "不明なエラーが発生しました"
            );
        } finally {
            setIsApplyingGps(false);
        }

        const totalSuccess = bulkGpsGroups.reduce((sum, g) => sum + g.videoIds.length, 0) + bulkNoGpsCount;
        showBulkSummary(totalSuccess, bulkSkippedCount, bulkErrorCount);
    }, [bulkGpsGroups, bulkNoGpsCount, bulkSkippedCount, bulkErrorCount, showBulkSummary]);

    /** GPS 設定をスキップして完了する */
    const handleGpsSkip = useCallback(() => {
        const totalSuccess = bulkGpsGroups.reduce((sum, g) => sum + g.videoIds.length, 0) + bulkNoGpsCount;
        showBulkSummary(totalSuccess, bulkSkippedCount, bulkErrorCount);
    }, [bulkGpsGroups, bulkNoGpsCount, bulkSkippedCount, bulkErrorCount, showBulkSummary]);

    // 撮影日時を取得（EXIF → MediaLibrary creationTime の順でフォールバック）
    const creationMs = (selectedAsset?.exif?.DateTimeOriginal
        ? parseExifDateTime(selectedAsset.exif.DateTimeOriginal)
        : null) ?? assetCreationTime;
    const capturedAt = creationMs != null ? Math.floor(creationMs / 1000) : null;

    // 一括インポート中 → プログレス表示
    if (bulkPhase === "importing") {
        return (
            <View style={styles.container}>
                <BulkImportProgress
                    current={bulkProgress.current}
                    total={bulkProgress.total}
                    skippedCount={bulkSkippedCount}
                    errorCount={bulkErrorCount}
                    currentFilename={bulkCurrentFilename}
                />
            </View>
        );
    }

    // 一括インポート後 → GPS 確認
    if (bulkPhase === "gps-confirm") {
        return (
            <View style={styles.container}>
                <GpsConfirmationDialog
                    groups={bulkGpsGroups}
                    noGpsCount={bulkNoGpsCount}
                    onToggleGroup={handleToggleGpsGroup}
                    onConfirm={handleGpsConfirm}
                    onSkip={handleGpsSkip}
                    isApplying={isApplyingGps}
                />
            </View>
        );
    }

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

                {/* 一括インポートボタン（動画未選択時のみ表示） */}
                {!selectedAsset && (
                    <TouchableOpacity style={styles.bulkButton} onPress={handlePickBulk}>
                        <Text style={styles.bulkButtonText}>
                            まとめてインポート (最大{BULK_SELECTION_LIMIT}本)
                        </Text>
                    </TouchableOpacity>
                )}

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
                        placeholder={capturedAt != null ? formatDateTime(capturedAt) : "タイトルを入力..."}
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
    bulkButton: {
        backgroundColor: Colors.alpineBlueLight,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 16,
    },
    bulkButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: Colors.alpineBlue,
    },
});
