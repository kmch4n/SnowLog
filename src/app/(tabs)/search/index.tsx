import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/colors";
import { FilterBar } from "@/components/FilterBar";
import { VideoCardCompact } from "@/components/VideoCardCompact";
import { useVideos } from "@/hooks/useVideos";
import type { FilterOptions } from "@/types";
import { parseSearchRouteParams } from "@/utils/searchRouteParams";

/**
 * 検索・フィルタ画面
 * スキー場名・タグでの絞り込みと検索結果一覧を表示する
 */
export default function SearchScreen() {
    const router = useRouter();
    const searchParams = useLocalSearchParams();
    const [filter, setFilter] = useState<FilterOptions>({});
    const { videos, isLoading, refresh } = useVideos(filter);
    const routeDateFrom = searchParams.dateFrom;
    const routeDateTo = searchParams.dateTo;
    const routeFavoritesOnly = searchParams.favoritesOnly;
    const routeRequestKey = searchParams.requestKey;
    const routeSearchText = searchParams.searchText;
    const routeSkiResortName = searchParams.skiResortName;
    const routeTagIds = searchParams.tagIds;

    const routeFilter = useMemo(
        () => parseSearchRouteParams({
            dateFrom: routeDateFrom,
            dateTo: routeDateTo,
            favoritesOnly: routeFavoritesOnly,
            requestKey: routeRequestKey,
            searchText: routeSearchText,
            skiResortName: routeSkiResortName,
            tagIds: routeTagIds,
        }),
        [
            routeDateFrom,
            routeDateTo,
            routeFavoritesOnly,
            routeRequestKey,
            routeSearchText,
            routeSkiResortName,
            routeTagIds,
        ]
    );

    useEffect(() => {
        if (routeFilter != null) {
            setFilter(routeFilter);
        }
    }, [routeFilter]);

    const handleVideoPress = useCallback(
        (id: string) => {
            router.push(`/video/${id}`);
        },
        [router]
    );

    return (
        <View style={styles.container}>
            <FilterBar filter={filter} onChange={setFilter} />

            {/* 検索結果件数 */}
            {!isLoading && (
                <View style={styles.resultCountRow}>
                    <Text style={styles.resultCount}>{videos.length}件</Text>
                </View>
            )}

            <FlatList
                data={videos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <VideoCardCompact video={item} onPress={() => handleVideoPress(item.id)} showResort />
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
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
        backgroundColor: Colors.glacierWhite,
    },
    resultCountRow: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: Colors.freshSnow,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.borderLight,
    },
    resultCount: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    listContent: {
        paddingBottom: 32,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.borderLight,
        marginLeft: 16 + 72 + 12,
    },
    empty: {
        alignItems: "center",
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
});
