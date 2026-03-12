import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { FilterBar } from "@/components/FilterBar";
import { VideoCard } from "@/components/VideoCard";
import { useVideos } from "@/hooks/useVideos";
import type { FilterOptions } from "@/types";

/**
 * 検索・フィルタ画面
 * スキー場名・タグでの絞り込みと検索結果一覧を表示する
 */
export default function SearchScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState<FilterOptions>({});
    const { videos, isLoading, refresh } = useVideos(filter);

    const handleVideoPress = useCallback(
        (id: string) => {
            router.push(`/video/${id}`);
        },
        [router]
    );

    return (
        <View style={styles.container}>
            <FilterBar filter={filter} onChange={setFilter} />

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
                            <Text style={styles.emptyText}>
                                該当する動画が見つかりません
                            </Text>
                        </View>
                    )
                }
            />
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
        paddingBottom: 32,
    },
    empty: {
        alignItems: "center",
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 15,
        color: "#888888",
    },
});
