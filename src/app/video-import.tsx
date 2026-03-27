import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
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

import { SkiResortSearch } from "@/components/SkiResortSearch";
import { TagSelector } from "@/components/TagSelector";
import { TechniqueSelector } from "@/components/TechniqueSelector";
import { getVideoByAssetId } from "@/database/repositories/videoRepository";
import { importVideo } from "@/services/importService";
import { getAssetInfo } from "@/services/mediaService";
import { formatDate, formatDuration } from "@/utils/dateUtils";
import { findNearbySkiResorts } from "@/utils/geoUtils";

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

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["videos"],
            allowsEditing: false,
            quality: 1,
            exif: true, // GPS フィールドを含む EXIF を取得
        });

        if (result.canceled || result.assets.length === 0) return;

        const asset = result.assets[0];
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

        setSelectedAsset(asset);
        setGpsSuggestions([]);

        // MediaLibrary のメタデータから GPS 座標を取得してスキー場をサジェスト
        // shouldDownloadFromNetwork: false により iCloud コンテンツのダウンロードを抑制し
        // PHPhotosErrorNetworkAccessRequired (3164) を防ぐ。
        // GPS は Photo Library DB に保存されたメタデータのためネットワーク不要で取得できる。
        if (asset.assetId) {
            const info = await getAssetInfo(asset.assetId, { shouldDownloadFromNetwork: false });
            if (info?.location) {
                setGpsSuggestions(
                    findNearbySkiResorts(info.location.latitude, info.location.longitude)
                );
            }
        }
    }, []);

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

        setIsSaving(true);
        try {
            // expo-image-picker の Asset を expo-media-library の Asset 形式に合わせる
            const mediaAsset = {
                id: selectedAsset.assetId,
                filename: selectedAsset.fileName ?? "video.mp4",
                creationTime: selectedAsset.exif?.DateTimeOriginal
                    ? new Date(selectedAsset.exif.DateTimeOriginal).getTime()
                    : Date.now(),
                duration: (selectedAsset.duration ?? 0) / 1000,
                uri: selectedAsset.uri,
                width: selectedAsset.width,
                height: selectedAsset.height,
                mediaType: "video" as const,
                albumId: undefined,
            };

            await importVideo(
                mediaAsset as any,
                { title: title.trim() || null, skiResortName, memo, tagIds, techniques },
                { pickerUri: selectedAsset.uri }
            );

            router.back();
        } catch (e) {
            Alert.alert(
                "インポートに失敗しました",
                e instanceof Error ? e.message : "不明なエラーが発生しました。"
            );
        } finally {
            setIsSaving(false);
        }
    }, [selectedAsset, title, skiResortName, memo, tagIds, techniques, router]);

    // 撮影日時を取得
    const capturedAt = selectedAsset?.exif?.DateTimeOriginal
        ? Math.floor(new Date(selectedAsset.exif.DateTimeOriginal).getTime() / 1000)
        : null;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

                {/* タイトル */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>タイトル</Text>
                    <TextInput
                        style={styles.titleInput}
                        value={title}
                        onChangeText={setTitle}
                        placeholder={selectedAsset?.fileName ?? "タイトルを入力..."}
                        placeholderTextColor="#AAAAAA"
                        returnKeyType="done"
                        numberOfLines={1}
                    />
                </View>

                {/* スキー場名 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>スキー場</Text>
                    {/* GPS撮影地からのサジェスト（スキー場未設定かつ GPS検出成功時のみ表示） */}
                    {gpsSuggestions.length > 0 && !skiResortName && (
                        <View style={styles.gpsBanner}>
                            <Text style={styles.gpsBannerLabel}>📍 撮影地の近くのスキー場</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.gpsBannerChips}
                                keyboardShouldPersistTaps="handled"
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
                    style={[styles.saveButton, !selectedAsset && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={!selectedAsset || isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#FFFFFF" />
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
        backgroundColor: "#F5F5F5",
    },
    scroll: {
        padding: 16,
        paddingBottom: 40,
    },
    pickButton: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        marginBottom: 16,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "#E0E0E0",
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
        color: "#888888",
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
        backgroundColor: "#E0E0E0",
    },
    previewMeta: {
        flex: 1,
    },
    previewFilename: {
        fontSize: 14,
        fontWeight: "600",
        color: "#222222",
    },
    previewDate: {
        fontSize: 12,
        color: "#888888",
        marginTop: 2,
    },
    previewDuration: {
        fontSize: 12,
        color: "#888888",
    },
    changeButton: {
        backgroundColor: "#F0F0F0",
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    changeButtonText: {
        fontSize: 13,
        color: "#333333",
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#333333",
        marginBottom: 8,
    },
    tagSelectorContainer: {
        minHeight: 120,
    },
    titleInput: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: "#222222",
    },
    memoInput: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        minHeight: 100,
        lineHeight: 22,
    },
    gpsBanner: {
        backgroundColor: "#E8F0F8",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginBottom: 8,
    },
    gpsBannerLabel: {
        fontSize: 12,
        color: "#1A3A5C",
        fontWeight: "600",
        marginBottom: 6,
    },
    gpsBannerChips: {
        gap: 6,
    },
    gpsBannerChip: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: "#1A3A5C",
        alignItems: "center",
    },
    gpsBannerChipName: {
        fontSize: 13,
        color: "#1A3A5C",
        fontWeight: "600",
    },
    gpsBannerChipDist: {
        fontSize: 11,
        color: "#5580A0",
        marginTop: 1,
    },
    saveButton: {
        backgroundColor: "#1A3A5C",
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 8,
    },
    saveButtonDisabled: {
        backgroundColor: "#AAAAAA",
    },
    saveButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
});
