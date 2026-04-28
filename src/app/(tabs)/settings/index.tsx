import { useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "@/constants/colors";
import { useTranslation } from "@/i18n/useTranslation";

type SettingsRoute =
    | "/settings/calendar"
    | "/settings/techniques"
    | "/settings/favorite-resorts"
    | "/settings/tags"
    | "/settings/duplicate-candidates"
    | "/settings/language";

interface SettingsItem {
    label: string;
    description: string;
    route: SettingsRoute;
}

export default function SettingsScreen() {
    const router = useRouter();
    const { t } = useTranslation();

    const items = useMemo<SettingsItem[]>(
        () => [
            {
                label: t("settings.menu.calendar"),
                description: t("settings.descriptions.calendar"),
                route: "/settings/calendar",
            },
            {
                label: t("settings.menu.techniques"),
                description: t("settings.descriptions.techniques"),
                route: "/settings/techniques",
            },
            {
                label: t("settings.menu.favoriteResorts"),
                description: t("settings.descriptions.favoriteResorts"),
                route: "/settings/favorite-resorts",
            },
            {
                label: t("settings.menu.tags"),
                description: t("settings.descriptions.tags"),
                route: "/settings/tags",
            },
            {
                label: t("settings.menu.duplicateCandidates"),
                description: t("settings.descriptions.duplicateCandidates"),
                route: "/settings/duplicate-candidates",
            },
            {
                label: t("settings.menu.language"),
                description: t("settings.descriptions.language"),
                route: "/settings/language",
            },
        ],
        [t]
    );

    return (
        <View style={styles.container}>
            <View style={styles.section}>
                {items.map((item, index) => (
                    <TouchableOpacity
                        key={item.route}
                        style={[
                            styles.row,
                            index === 0 && styles.rowFirst,
                            index === items.length - 1 && styles.rowLast,
                        ]}
                        onPress={() => router.push(item.route as Href)}
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
