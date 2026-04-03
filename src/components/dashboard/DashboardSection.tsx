import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../../constants/colors";

interface DashboardSectionProps {
    title: string;
    children: React.ReactNode;
    rightAction?: { label: string; onPress: () => void };
}

/** ダッシュボードの各セクションを囲むカードコンポーネント */
export function DashboardSection({ title, children, rightAction }: DashboardSectionProps) {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {rightAction && (
                    <TouchableOpacity onPress={rightAction.onPress}>
                        <Text style={styles.actionText}>{rightAction.label}</Text>
                    </TouchableOpacity>
                )}
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.freshSnow,
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    title: {
        fontSize: 15,
        fontWeight: "700",
        color: Colors.textPrimary,
    },
    actionText: {
        fontSize: 13,
        color: Colors.alpineBlue,
        fontWeight: "600",
    },
});
