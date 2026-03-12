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
import { getVideoByAssetId } from "@/database/repositories/videoRepository";
import { importVideo } from "@/services/importService";
import { formatDate, formatDuration } from "@/utils/dateUtils";

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
    const [skiResortName, setSkiResortName] = useState<string | null>(null);
    const [tagIds, setTagIds] = useState<number[]>([]);
    const [memo, setMemo] = useState("");
    const [isSaving, setIsSaving] = useState(false);

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
                    "この動画は既にインポートされています。",
                    [{ text: "OK" }]
                );
                return;
            }
        }

        setSelectedAsset(asset);
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
                duration: selectedAsset.duration ?? 0,
                uri: selectedAsset.uri,
                width: selectedAsset.width,
                height: selectedAsset.height,
                mediaType: "video" as const,
                albumId: undefined,
            };

            await importVideo(mediaAsset as any, {
                skiResortName,
                memo,
                tagIds,
            });

            router.back();
        } catch (e) {
            Alert.alert(
                "インポートに失敗しました",
                e instanceof Error ? e.message : "不明なエラーが発生しました。"
            );
        } finally {
            setIsSaving(false);
        }
    }, [selectedAsset, skiResortName, memo, tagIds, router]);

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
                                        {formatDuration(Math.round(selectedAsset.duration))}
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

                {/* スキー場名 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>スキー場</Text>
                    <SkiResortSearch value={skiResortName} onSelect={setSkiResortName} />
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
