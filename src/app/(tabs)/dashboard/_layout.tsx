import { Stack } from "expo-router";

import { Colors } from "@/constants/colors";
import { useTranslation } from "@/i18n/useTranslation";

export default function DashboardLayout() {
    const { t } = useTranslation();

    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: Colors.headerBg },
                headerTintColor: Colors.headerText,
                headerTitleStyle: { fontWeight: "700" },
            }}
        >
            <Stack.Screen name="index" options={{ title: t("dashboard.title") }} />
        </Stack>
    );
}
