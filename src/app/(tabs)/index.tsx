import { useRouter } from "expo-router";
import { useCallback } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { VideoCard } from "@/components/VideoCard";
import { useVideos } from "@/hooks/useVideos";

/**
 * ホーム画面
 * インポート済み動画の一覧と、インポートボタンを表示する
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

    return (
        <View style={styles.container}>
            <FlatList
                data={videos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <VideoCard video={item} onPress={() => handleVideoPress(item.id)} />
                )}
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
        backgroundColor: "#F5F5F5",
    },
    listContent: {
        paddingTop: 8,
        paddingBottom: 100,
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
        color: "#333333",
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: "#888888",
        textAlign: "center",
        lineHeight: 20,
    },
    fab: {
        position: "absolute",
        bottom: 32,
        alignSelf: "center",
        backgroundColor: "#1A3A5C",
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
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
});
