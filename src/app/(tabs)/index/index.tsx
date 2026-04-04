import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

import { VideoCardCompact } from "@/components/VideoCardCompact";
import { Colors } from "@/constants/colors";
import { useVideos } from "@/hooks/useVideos";
import type { VideoWithTags } from "@/types";

interface VideoSection {
    title: string;
    data: VideoWithTags[];
}

/** スキー場別にグループ化し、最新動画が新しい順にセクションを並べる */
function buildSections(videos: VideoWithTags[]): VideoSection[] {
    const map = new Map<string, VideoWithTags[]>();
    for (const video of videos) {
        const key = video.skiResortName ?? "スキー場未設定";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(video);
    }
    return Array.from(map.entries())
        .sort((a, b) => (b[1][0]?.capturedAt ?? 0) - (a[1][0]?.capturedAt ?? 0))
        .map(([title, data]) => ({ title, data }));
}

const TABS = [
    { key: "all", label: "すべて" },
    { key: "favorites", label: "★ お気に入り" },
] as const;

/**
 * ホーム画面
 * 横スワイプで「全動画」と「お気に入り」を切り替え可能
 */
export default function HomeScreen() {
    const router = useRouter();
    const { width: screenWidth } = useWindowDimensions();
    const scrollRef = useRef<ScrollView>(null);
    const [activeTab, setActiveTab] = useState(0);

    const { videos: allVideos, isLoading: allLoading, refresh: refreshAll } = useVideos();
    const { videos: favVideos, isLoading: favLoading, refresh: refreshFav } = useVideos({ favoritesOnly: true });

    const handleVideoPress = useCallback(
        (id: string) => {
            router.push(`/video/${id}`);
        },
        [router]
    );

    const handleImportPress = useCallback(() => {
        router.push("/video-import");
    }, [router]);

    const allSections = useMemo(() => buildSections(allVideos), [allVideos]);
    const favSections = useMemo(() => buildSections(favVideos), [favVideos]);

    /** スクロール位置からアクティブタブを同期 */
    const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setActiveTab(page);
        },
        [screenWidth]
    );

    /** タブタップでページを切り替え */
    const handleTabPress = useCallback(
        (index: number) => {
            scrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
            setActiveTab(index);
        },
        [screenWidth]
    );

    const renderItem = useCallback(
        ({ item }: { item: VideoWithTags }) => (
            <VideoCardCompact
                video={item}
                onPress={() => handleVideoPress(item.id)}
            />
        ),
        [handleVideoPress]
    );

    const renderSectionHeader = useCallback(
        ({ section }: { section: VideoSection }) => (
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                    📍 {section.title}
                </Text>
                <Text style={styles.sectionCount}>{section.data.length}件</Text>
            </View>
        ),
        []
    );

    return (
        <View style={styles.container}>
            {/* セグメントコントロール */}
            <View style={styles.segmentBar}>
                {TABS.map((tab, i) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.segmentTab, activeTab === i && styles.segmentTabActive]}
                        onPress={() => handleTabPress(i)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.segmentText, activeTab === i && styles.segmentTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* 横スワイプページャー */}
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                scrollEventThrottle={16}
                style={styles.pager}
            >
                {/* ページ 1: 全動画 */}
                <View style={{ width: screenWidth }}>
                    <SectionList
                        sections={allSections}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        renderSectionFooter={() => <View style={styles.sectionFooter} />}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                        onRefresh={refreshAll}
                        refreshing={allLoading && allVideos.length > 0}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            allLoading ? null : (
                                <View style={styles.empty}>
                                    <Text style={styles.emptyTitle}>動画がありません</Text>
                                    <Text style={styles.emptySubtitle}>
                                        下のボタンからスキー動画をインポートしてください
                                    </Text>
                                </View>
                            )
                        }
                    />
                </View>

                {/* ページ 2: お気に入り */}
                <View style={{ width: screenWidth }}>
                    <SectionList
                        sections={favSections}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        renderSectionFooter={() => <View style={styles.sectionFooter} />}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                        onRefresh={refreshFav}
                        refreshing={favLoading && favVideos.length > 0}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            favLoading ? null : (
                                <View style={styles.empty}>
                                    <Text style={styles.emptyTitle}>お気に入りがありません</Text>
                                    <Text style={styles.emptySubtitle}>
                                        動画詳細画面の ★ ボタンでお気に入りに追加しましょう
                                    </Text>
                                </View>
                            )
                        }
                    />
                </View>
            </ScrollView>

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
    segmentBar: {
        flexDirection: "row",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    segmentTab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
        backgroundColor: Colors.frostGray,
    },
    segmentTabActive: {
        backgroundColor: Colors.alpineBlue,
    },
    segmentText: {
        fontSize: 14,
        fontWeight: "600",
        color: Colors.textSecondary,
    },
    segmentTextActive: {
        color: Colors.headerText,
    },
    pager: {
        flex: 1,
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
        marginLeft: 16 + 72 + 12,
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
