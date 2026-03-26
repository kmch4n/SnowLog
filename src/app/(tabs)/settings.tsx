import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface SettingsItem {
    label: string;
    description: string;
    route: string;
}

const SETTINGS_ITEMS: SettingsItem[] = [
    {
        label: "滑走種別の管理",
        description: "種別の追加・削除",
        route: "/settings/techniques",
    },
];

/**
 * 設定トップ画面
 * 各設定項目へのナビゲーションメニュー
 */
export default function SettingsScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <View style={styles.section}>
                {SETTINGS_ITEMS.map((item, index) => (
                    <TouchableOpacity
                        key={item.route}
                        style={[
                            styles.row,
                            index === 0 && styles.rowFirst,
                            index === SETTINGS_ITEMS.length - 1 && styles.rowLast,
                        ]}
                        onPress={() => router.push(item.route as any)}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
        padding: 16,
    },
    section: {
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
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
        color: "#222222",
    },
    rowDescription: {
        fontSize: 12,
        color: "#888888",
        marginTop: 2,
    },
    chevron: {
        fontSize: 22,
        color: "#AAAAAA",
        marginLeft: 8,
    },
});
