import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { VideoCardCompact } from "@/components/VideoCardCompact";
import { Colors } from "@/constants/colors";
import { useVideos } from "@/hooks/useVideos";
import type { VideoWithTags } from "@/types";

interface VideoSection {
    title: string;
    data: VideoWithTags[];
}

/**
 * ホーム画面
 * スキー場別にグループ化した動画一覧を表示する
 */
export default function HomeScreen() {
    const router = useRouter();
    const { videos, isLoading, refresh } = useVideos();

    const handleVideoPress = useCallback(
        (id: string) => {
            router.push(`/video/${id}`);
        },
        [router]
    );

    const handleImportPress = useCallback(() => {
        router.push("/video-import");
    }, [router]);

    /** スキー場別にグループ化し、最新動画が新しい順にセクションを並べる */
    const sections = useMemo((): VideoSection[] => {
        const map = new Map<string, VideoWithTags[]>();
        for (const video of videos) {
            const key = video.skiResortName ?? "スキー場未設定";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(video);
        }
        return Array.from(map.entries())
            .sort((a, b) => (b[1][0]?.capturedAt ?? 0) - (a[1][0]?.capturedAt ?? 0))
            .map(([title, data]) => ({ title, data }));
    }, [videos]);

    return (
        <View style={styles.container}>
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <VideoCardCompact
                        video={item}
                        onPress={() => handleVideoPress(item.id)}
                    />
                )}
                renderSectionHeader={({ section }) => (
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            📍 {section.title}
                        </Text>
                        <Text style={styles.sectionCount}>{section.data.length}件</Text>
                    </View>
                )}
                renderSectionFooter={() => <View style={styles.sectionFooter} />}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                onRefresh={refresh}
                refreshing={isLoading && videos.length > 0}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    isLoading ? null : (
                        <View style={styles.empty}>
                            <Text style={styles.emptyTitle}>動画がありません</Text>
                            <Text style={styles.emptySubtitle}>
                                下のボタンからスキー動画をインポートしてください
                            </Text>
                        </View>
                    )
                }
            />

            {/* インポートFAB */}
            <TouchableOpacity style={styles.fab} onPress={handleImportPress}>
                <Text style={styles.fabText}>＋ インポート</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
    },
    listContent: {
        paddingBottom: 100,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.glacierWhite,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
    },
    sectionTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    sectionCount: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    sectionFooter: {
        height: 8,
        backgroundColor: Colors.glacierWhite,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.borderLight,
        marginLeft: 16 + 72 + 12, // サムネイル分インデント
    },
    empty: {
        flex: 1,
        alignItems: "center",
        paddingTop: 80,
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 20,
    },
    fab: {
        position: "absolute",
        bottom: 100,
        alignSelf: "center",
        backgroundColor: Colors.alpineBlue,
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingVertical: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
    },
    fabText: {
        color: Colors.headerText,
        fontSize: 16,
        fontWeight: "700",
    },
});
