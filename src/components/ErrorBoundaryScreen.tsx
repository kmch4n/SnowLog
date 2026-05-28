import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Colors } from "@/constants/colors";
import { IconNames } from "@/constants/icons";
import { useTranslation } from "@/i18n/useTranslation";
import { hapticError } from "@/services/hapticsService";

interface ErrorBoundaryScreenProps {
    error: Error;
    retry: () => void;
}

/**
 * Full-screen fallback rendered by the Expo Router ErrorBoundary export when
 * a route subtree throws during render. Surfaces a retry path so the app can
 * recover without a force quit.
 */
export function ErrorBoundaryScreen({ error, retry }: ErrorBoundaryScreenProps) {
    const { t } = useTranslation();

    useEffect(() => {
        hapticError();
        console.error("[ErrorBoundary]", error);
    }, [error]);

    return (
        <View style={styles.container}>
            <Icon
                name={IconNames.warning}
                size={48}
                color={Colors.error}
                weight="semibold"
                fallback="!"
            />
            <Text style={styles.title}>{t("errors.boundary.title")}</Text>
            <Text style={styles.body}>{t("errors.boundary.body")}</Text>
            {__DEV__ ? (
                <Text style={styles.detail} numberOfLines={4}>
                    {error.message}
                </Text>
            ) : null}
            <Pressable
                onPress={retry}
                style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
            >
                <Text style={styles.buttonLabel}>
                    {t("errors.boundary.retry")}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.freshSnow,
        paddingHorizontal: 32,
        gap: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: Colors.textPrimary,
        marginTop: 8,
    },
    body: {
        fontSize: 13,
        color: Colors.textSecondary,
        textAlign: "center",
        lineHeight: 20,
    },
    detail: {
        fontSize: 11,
        color: Colors.textTertiary,
        textAlign: "center",
        marginTop: 4,
    },
    button: {
        marginTop: 16,
        backgroundColor: Colors.alpineBlue,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonPressed: {
        opacity: 0.7,
    },
    buttonLabel: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "600",
    },
});
