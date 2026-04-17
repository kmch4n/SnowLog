import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SwipeableTabWrapper } from "@/components/SwipeableTabWrapper";
import { Colors } from "@/constants/colors";

type SettingsRoute =
    | "/settings/calendar"
    | "/settings/techniques"
    | "/settings/favorite-resorts"
    | "/settings/tags"
    | "/settings/duplicate-candidates";

interface SettingsItem {
    label: string;
    description: string;
    route: SettingsRoute;
}

const SETTINGS_ITEMS: SettingsItem[] = [
    {
        label: "カレンダー設定",
        description: "週の開始曜日を変更",
        route: "/settings/calendar",
    },
    {
        label: "滑走種別の管理",
        description: "選択候補の追加と削除",
        route: "/settings/techniques",
    },
    {
        label: "お気に入りスキー場",
        description: "入力候補に出すスキー場を管理",
        route: "/settings/favorite-resorts",
    },
    {
        label: "タグの管理",
        description: "カスタムタグの追加と削除",
        route: "/settings/tags",
    },
    {
        label: "重複候補の確認",
        description: "似ている動画をまとめて確認",
        route: "/settings/duplicate-candidates",
    },
];

export default function SettingsScreen() {
    const router = useRouter();

    return (
        <SwipeableTabWrapper tabIndex={4} style={styles.container}>
            <View style={styles.section}>
                {SETTINGS_ITEMS.map((item, index) => (
                    <TouchableOpacity
                        key={item.route}
                        style={[
                            styles.row,
                            index === 0 && styles.rowFirst,
                            index === SETTINGS_ITEMS.length - 1 && styles.rowLast,
                        ]}
                        onPress={() => router.push(item.route)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.rowContent}>
                            <Text style={styles.rowLabel}>{item.label}</Text>
                            <Text style={styles.rowDescription}>{item.description}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </SwipeableTabWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.glacierWhite,
        padding: 16,
    },
    section: {
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Colors.border,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    rowFirst: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    rowLast: {
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    rowContent: {
        flex: 1,
    },
    rowLabel: {
        fontSize: 16,
        color: Colors.textPrimary,
    },
    rowDescription: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    chevron: {
        fontSize: 22,
        color: Colors.textTertiary,
        marginLeft: 8,
    },
});
