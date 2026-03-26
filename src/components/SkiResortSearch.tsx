import { useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

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
        setQuery(resort.name);
        setIsFocused(false);
        onSelect(resort.name);
    }

    function handleClear() {
        setQuery("");
        onSelect(null);
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
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                    placeholder="スキー場名を検索..."
                    returnKeyType="done"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                        <Text style={styles.clearText}>×</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* サジェストリスト */}
            {isFocused && suggestions.length > 0 && (
                <ScrollView
                    style={styles.suggestionList}
                    keyboardShouldPersistTaps="handled"
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
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "relative",
        zIndex: 10,
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
    suggestionList: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 8,
        maxHeight: 240,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
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
