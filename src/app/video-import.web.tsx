/**
 * Web用インポート画面
 * expo-image-picker はブラウザ非対応のため、未対応メッセージを表示する
 */
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function VideoImportScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>🎬</Text>
            <Text style={styles.title}>iOSアプリでご利用ください</Text>
            <Text style={styles.description}>
                動画のインポートはiOSアプリでのみ利用できます。{"\n"}
                EAS Build でアプリをビルドしてお試しください。
            </Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>戻る</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F5F5F5",
        padding: 32,
    },
    icon: {
        fontSize: 64,
        marginBottom: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: "#222222",
        marginBottom: 12,
        textAlign: "center",
    },
    description: {
        fontSize: 14,
        color: "#666666",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 32,
    },
    backButton: {
        backgroundColor: "#1A3A5C",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 32,
    },
    backButtonText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "600",
    },
});
