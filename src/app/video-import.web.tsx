/**
 * Web用インポート画面
 * expo-image-picker はブラウザ非対応のため、未対応メッセージを表示する
 */
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useTranslation } from "@/i18n/useTranslation";

export default function VideoImportScreen() {
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>🎬</Text>
            <Text style={styles.title}>{t("import.webUnsupportedTitle")}</Text>
            <Text style={styles.description}>
                {t("import.webUnsupportedBody")}
            </Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>{t("common.back")}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.glacierWhite,
        padding: 32,
    },
    icon: {
        fontSize: 64,
        marginBottom: 24,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginBottom: 12,
        textAlign: "center",
    },
    description: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 32,
    },
    backButton: {
        backgroundColor: Colors.alpineBlue,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 32,
    },
    backButtonText: {
        color: Colors.headerText,
        fontSize: 15,
        fontWeight: "600",
    },
});
