import { useEffect, useMemo, useRef, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { getFavoriteResorts } from "../database/repositories/favoriteResortRepository";
import SKI_RESORTS from "../constants/skiResorts.json";
import type { SkiResort } from "../types";

interface SkiResortSearchProps {
    value: string | null;
    onSelect: (name: string | null) => void;
}

const MAX_RESULTS = 20;

/**
 * スキー場名のインクリメンタル検索コンポーネント
 * src/constants/skiResorts.json のマスターデータからフィルタリングする
 */
export function SkiResortSearch({ value, onSelect }: SkiResortSearchProps) {
    const [query, setQuery] = useState(value ?? "");
    const [isFocused, setIsFocused] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 親から value が変化したとき（clearAll など）に内部状態を同期する
    useEffect(() => {
        setQuery(value ?? "");
    }, [value]);

    // お気に入りスキー場をロード
    useEffect(() => {
        getFavoriteResorts().then(setFavorites);
    }, []);

    const suggestions = useMemo<SkiResort[]>(() => {
        if (!query.trim()) return [];
        const lower = query.toLowerCase();
        return (SKI_RESORTS as SkiResort[])
            .filter(
                (r) =>
                    r.name.toLowerCase().includes(lower) ||
                    r.prefecture.includes(query)
            )
            .slice(0, MAX_RESULTS);
    }, [query]);

    function handleSelect(resort: SkiResort) {
        // onBlur タイマーが残っていればキャンセル（レース条件防止）
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setQuery(resort.name);
        setIsFocused(false);
        onSelect(resort.name);
    }

    function handleClear() {
        setQuery("");
        onSelect(null);
    }

    function handleFavoriteSelect(name: string) {
        setQuery(name);
        onSelect(name);
    }

    return (
        <View style={styles.container}>
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={(text) => {
                        setQuery(text);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        blurTimeoutRef.current = setTimeout(() => {
                            setIsFocused(false);
                            blurTimeoutRef.current = null;
                        }, 200);
                    }}
                    placeholder="スキー場名を検索..."
                    returnKeyType="done"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                        <Text style={styles.clearText}>×</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* お気に入りチップ（query が空のときのみ表示） */}
            {!query && favorites.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.favoriteScroll}
                    contentContainerStyle={styles.favoriteScrollContent}
                    keyboardShouldPersistTaps="always"
                >
                    {favorites.map((name) => (
                        <TouchableOpacity
                            key={name}
                            style={styles.favoriteChip}
                            onPress={() => handleFavoriteSelect(name)}
                        >
                            <Text style={styles.favoriteChipText}>⭐ {name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* サジェストリスト */}
            {isFocused && suggestions.length > 0 && (
                <View style={styles.suggestionWrapper}>
                    <ScrollView
                        style={styles.suggestionList}
                        keyboardShouldPersistTaps="always"
                        nestedScrollEnabled
                    >
                        {suggestions.map((item, index) => (
                            <View key={String(item.id)}>
                                {index > 0 && <View style={styles.separator} />}
                                <TouchableOpacity
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelect(item)}
                                >
                                    <Text style={styles.suggestionName}>{item.name}</Text>
                                    <Text style={styles.suggestionPrefecture}>{item.prefecture}</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "relative",
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 8,
        backgroundColor: "#FFFFFF",
    },
    input: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
    },
    clearButton: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    clearText: {
        fontSize: 18,
        color: "#AAAAAA",
    },
    favoriteScroll: {
        marginTop: 8,
    },
    favoriteScrollContent: {
        gap: 6,
    },
    favoriteChip: {
        backgroundColor: "#EBF2FA",
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: "#C8DCEF",
    },
    favoriteChipText: {
        fontSize: 13,
        color: "#1A3A5C",
        fontWeight: "600",
    },
    suggestionWrapper: {
        marginTop: 6,
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
        overflow: "hidden",
    },
    suggestionList: {
        maxHeight: 240,
    },
    suggestionItem: {
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    suggestionName: {
        fontSize: 14,
        color: "#222222",
    },
    suggestionPrefecture: {
        fontSize: 12,
        color: "#888888",
        marginTop: 1,
    },
    separator: {
        height: 1,
        backgroundColor: "#F0F0F0",
    },
});
